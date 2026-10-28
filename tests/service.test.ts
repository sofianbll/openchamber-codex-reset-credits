import { describe, expect, test } from 'bun:test';
import { createCreditsService } from '../src/service/credits.ts';
import { createServiceServer } from '../src/service/server.ts';
import type { Account } from '../src/service/accounts.ts';

const backend = 'https://chatgpt.com/backend-api/wham/rate-limit-reset-credits';
const now = Date.parse('2026-10-28T12:00:00Z');
const accounts: Account[] = [
  { id: 'first', label: 'First', active: true, access: 'synthetic-first-secret', accountID: 'physical-first' },
  { id: 'second', label: 'Second', active: false, access: 'synthetic-second-secret', accountID: 'physical-second' },
];
const credit = { id: 'specific-credit', status: 'available', reset_type: 'codex' };
const payload = (credits: object[] = [credit]) => ({ credits, available_count: credits.length });
const input = (credentialID = 'second') => ({ credentialID, creditID: credit.id, confirmed: true });
const json = (body: unknown, status = 200) => Response.json(body, { status });
type Call = { url: string; init: RequestInit };
function setup(handler: (call: Call) => Response | Promise<Response>, selected = accounts) {
  const calls: Call[] = [];
  const service = createCreditsService({
    accounts: async () => selected,
    now: () => now,
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      const call = { url: String(url), init: init ?? {} };
      calls.push(call);
      return handler(call);
    }) as typeof fetch,
  });
  return { service, calls };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('credit service', () => {
  test('lists multiple accounts with isolated auth, partial errors, and no secret output', async () => {
    const { service, calls } = setup(({ init }) => new Headers(init.headers).get('Authorization') === 'Bearer synthetic-first-secret'
      ? json(payload()) : new Response('raw synthetic-second-secret refresh-secret', { status: 401 }));
    const result = await service.list();
    expect(result.accounts[0]).toMatchObject({ id: 'first', availableCount: 1, error: null });
    expect(result.accounts[1]).toEqual({ id: 'second', label: 'Second', active: false, credits: null, availableCount: null, error: 'SIGN_IN_REQUIRED' });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(calls).toHaveLength(2);
    for (const [index, call] of calls.entries()) {
      expect(call.url).toBe(backend);
      expect(call.init.method).toBe('GET');
      expect(call.init.redirect).toBe('error');
      expect(new Headers(call.init.headers).get('Authorization')).toBe(`Bearer ${accounts[index]!.access}`);
      expect(new Headers(call.init.headers).get('ChatGPT-Account-Id')).toBe(accounts[index]!.accountID);
    }
  });

  test('redeems selected inactive credential and locks successful attempts without retries', async () => {
    const { service, calls } = setup(({ init }) => json(init.method === 'POST' ? { code: 'success', windows_reset: 2 } : payload()));
    expect(await service.redeem(input())).toEqual({ code: 'success', windowsReset: 2 });
    const posts = calls.filter(({ init }) => init.method === 'POST');
    expect(posts).toHaveLength(1);
    const post = posts[0]!;
    expect(post.url).toBe(`${backend}/consume`);
    expect(new Headers(post.init.headers).get('Authorization')).toBe('Bearer synthetic-second-secret');
    expect(new Headers(post.init.headers).get('ChatGPT-Account-Id')).toBe('physical-second');
    expect(new Headers(post.init.headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(post.init.body))).toEqual({ credit_id: 'specific-credit', redeem_request_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/) });
    await expect(service.redeem(input())).rejects.toMatchObject({ code: 'ALREADY_REQUESTED' });
    expect(calls.filter(({ init }) => init.method === 'POST')).toHaveLength(1);
    expect((await service.list()).accounts[1]?.credits?.[0]?.redemption).toBe('requested');
  });

  test.each([
    [], [{ ...credit, status: 'used' }], [{ ...credit, expires_at: new Date(now).toISOString() }],
  ].map((credits) => ({ credits })))('revalidates unavailable or expired credits before any POST %#', async ({ credits }) => {
    const { service, calls } = setup(() => json(payload(credits)));
    await expect(service.redeem(input())).rejects.toMatchObject({ code: 'CREDIT_UNAVAILABLE', status: 409 });
    expect(calls.map(({ init }) => init.method)).toEqual(['GET']);
  });

  test('duplicate logins for one physical account cannot concurrently consume twice', async () => {
    const preflight = deferred<Response>();
    const entered = deferred<void>();
    const duplicates = [accounts[0]!, { ...accounts[1]!, accountID: accounts[0]!.accountID }];
    const { service, calls } = setup(({ init }) => {
      if (init.method === 'GET') { entered.resolve(); return preflight.promise; }
      return json({ code: 'success' });
    }, duplicates);
    const first = service.redeem(input('first'));
    await entered.promise;
    await expect(service.redeem(input('second'))).rejects.toMatchObject({ code: 'ALREADY_REQUESTED' });
    preflight.resolve(json(payload()));
    await first;
    expect(calls.filter(({ init }) => init.method === 'POST')).toHaveLength(1);
  });

  test('cached availability cannot bypass a fresh redemption preflight', async () => {
    let available = true;
    const { service, calls } = setup(() => json(payload(available ? [credit] : [])), [accounts[0]!]);
    expect((await service.list()).accounts[0]?.availableCount).toBe(1);
    available = false;
    await expect(service.redeem(input('first'))).rejects.toMatchObject({ code: 'CREDIT_UNAVAILABLE' });
    expect(calls.map(({ init }) => init.method)).toEqual(['GET', 'GET']);
    available = true;
    expect((await service.list()).accounts[0]?.credits?.[0]?.redemption).toBeUndefined();
  });

  test('a snapshot cached during a pending POST is invalidated when its outcome becomes unknown', async () => {
    const post = deferred<Response>();
    const entered = deferred<void>();
    const { service } = setup(({ init }) => {
      if (init.method === 'POST') { entered.resolve(); return post.promise; }
      return json(payload());
    }, [accounts[0]!]);
    const redeem = service.redeem(input('first'));
    await entered.promise;
    expect((await service.list()).accounts[0]?.credits?.[0]?.redemption).toBe('pending');
    const outcome = redeem.catch((error: unknown) => error);
    post.resolve(new Response('synthetic-secret', { status: 500 }));
    expect(await outcome).toMatchObject({ code: 'REDEMPTION_UNKNOWN' });
    expect((await service.list()).accounts[0]?.credits?.[0]?.redemption).toBe('unknown');
  });

  test('invalid selection and missing physical account ID cause no upstream request', async () => {
    const { service, calls } = setup(() => { throw new Error('Must not fetch'); }, [{ ...accounts[0]!, accountID: null }]);
    await expect(service.redeem(input('missing'))).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' });
    await expect(service.redeem(input('first'))).rejects.toMatchObject({ code: 'ACCOUNT_ID_MISSING' });
    await expect(service.redeem({ ...input('first'), confirmed: false })).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(calls).toHaveLength(0);
  });

  test.each(['network', 'non2xx', 'malformed-json', 'malformed-result'])('ambiguous POST %s stays unknown and never retries', async (mode) => {
    const { service, calls } = setup(({ init }) => {
      if (init.method === 'GET') return json(payload());
      if (mode === 'network') throw new Error('raw synthetic-secret');
      if (mode === 'non2xx') return new Response('raw synthetic-secret', { status: 503 });
      if (mode === 'malformed-json') return new Response('not JSON');
      return json({ code: '<raw synthetic-secret>' });
    });
    await expect(service.redeem(input())).rejects.toMatchObject({ message: 'REDEMPTION_UNKNOWN', status: 409 });
    await expect(service.redeem(input())).rejects.toMatchObject({ code: 'ALREADY_REQUESTED' });
    const result = await service.list(true);
    expect(result.accounts[1]?.credits?.[0]?.redemption).toBe('unknown');
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(calls.filter(({ init }) => init.method === 'POST')).toHaveLength(1);
  });

  test('coalesces snapshots, caches them, and forces explicit refresh', async () => {
    const gate = deferred<Response>();
    const { service, calls } = setup(() => gate.promise, [accounts[0]!]);
    const first = service.list();
    const second = service.list(true);
    gate.resolve(json(payload()));
    expect(await first).toEqual(await second);
    await service.list();
    expect(calls).toHaveLength(1);
    // A fresh Response is needed because a response body can only be consumed once.
    const fresh = setup(() => json(payload()), [accounts[0]!]);
    await fresh.service.list();
    await fresh.service.list(true);
    expect(fresh.calls).toHaveLength(2);
  });

  test('a completed account read cannot escape stale while another account is still loading', async () => {
    const slowAccount = deferred<Response>();
    const entered = deferred<void>();
    let secondGets = 0;
    const { service } = setup(({ init }) => {
      if (init.method === 'POST') return json({ code: 'success' });
      if (new Headers(init.headers).get('ChatGPT-Account-Id') === 'physical-second' && ++secondGets === 1) {
        entered.resolve();
        return slowAccount.promise;
      }
      return json(payload());
    });
    const initial = service.list();
    await entered.promise;
    await new Promise<void>((resolve) => setImmediate(resolve));
    await service.redeem(input('first'));
    const joined = service.list(true);
    slowAccount.resolve(json(payload()));
    for (const result of await Promise.all([initial, joined])) {
      expect(result.accounts[0]?.credits?.[0]?.redemption).toBe('requested');
    }
  });

  test('a snapshot started before redemption cannot repopulate its invalidated cache', async () => {
    const stale = deferred<Response>();
    const entered = deferred<void>();
    let gets = 0;
    const { service, calls } = setup(({ init }) => {
      if (init.method === 'POST') return json({ code: 'success' });
      if (++gets === 1) { entered.resolve(); return stale.promise; }
      return json(payload());
    }, [accounts[0]!]);
    const listing = service.list();
    await entered.promise;
    await service.redeem(input('first'));
    stale.resolve(json(payload()));
    await listing;
    const result = await service.list();
    expect(calls.filter(({ init }) => init.method === 'GET')).toHaveLength(3);
    expect(result.accounts[0]?.credits?.[0]?.redemption).toBe('requested');
  });
});

test('HTTP boundary authenticates health and rejects invalid requests without leaking errors', async () => {
  const { service } = setup(() => { throw new Error('raw synthetic-access refresh-secret'); });
  const server = createServiceServer('synthetic-service-token', service);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP address');
  const base = `http://127.0.0.1:${address.port}`;
  const headers = { Authorization: 'Bearer synthetic-service-token', 'Content-Type': 'application/json' };
  try {
    for (const path of ['/health', '/accounts', '/redeem']) {
      const denied = await fetch(`${base}${path}`);
      expect(denied.status).toBe(401);
      expect(await denied.json()).toEqual({ error: 'UNAUTHORIZED' });
    }
    expect((await fetch(`${base}/health`, { headers: { Authorization: 'Bearer wrong' } })).status).toBe(401);
    const health = await fetch(`${base}/health`, { headers });
    expect(await health.json()).toEqual({ ok: true });
    expect(health.headers.get('Cache-Control')).toBe('no-store');
    expect((await fetch(`${base}/accounts`, { method: 'POST', headers })).status).toBe(404);
    for (const [body, status] of [['{', 400], ['x'.repeat(4097), 413]] as const) {
      const response = await fetch(`${base}/redeem`, { method: 'POST', headers, body });
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ error: 'INVALID_REQUEST' });
    }
    expect((await fetch(`${base}/redeem`, { method: 'POST', headers: { Authorization: headers.Authorization }, body: '{}' })).status).toBe(400);
    const result = await fetch(`${base}/accounts`, { headers });
    const text = await result.text();
    expect(text).toContain('CODEX_UNREACHABLE');
    expect(text).not.toContain('secret');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('HTTP boundary replaces unexpected internal errors with SERVICE_ERROR', async () => {
  const service = createCreditsService({ accounts: async () => { throw new Error('synthetic-secret'); }, fetch, now: () => now });
  const server = createServiceServer('synthetic-token', service);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP address');
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/accounts`, { headers: { Authorization: 'Bearer synthetic-token' } });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'SERVICE_ERROR' });
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
