import { randomUUID } from 'node:crypto';
import {
  Failure, canRedeem, parseCredits, parseRedeemInput, parseRedeemResult,
  type AccountSnapshot, type Credit, type RedemptionState, type RedeemResult, type Snapshot,
} from '../contracts.ts';
import { readAccounts, type Account } from './accounts.ts';

const backend = 'https://chatgpt.com/backend-api/wham/rate-limit-reset-credits';
type Dependencies = { accounts: () => Promise<Account[]>; fetch: typeof globalThis.fetch; now: () => number };

export function createCreditsService(deps: Dependencies = { accounts: readAccounts, fetch: globalThis.fetch, now: Date.now }) {
  let cached: Snapshot | null = null;
  let loading: Promise<Snapshot> | null = null;
  let revision = 0;
  // A lock belongs to the ChatGPT account, not a potentially duplicated OpenCode login.
  // shortcut: locks are memory-only; persist them before adding restart-safe retries.
  const attempts = new Map<string, RedemptionState>();
  const key = (account: Account, creditID: string) => JSON.stringify([account.accountID, creditID]);

  async function request(account: Account, body?: { credit_id: string; redeem_request_id: string }): Promise<unknown> {
    if (!account.accountID) throw new Failure('ACCOUNT_ID_MISSING', 409);
    let response: Response;
    try {
      response = await deps.fetch(body ? `${backend}/consume` : backend, {
        method: body ? 'POST' : 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: `Bearer ${account.access}`,
          'ChatGPT-Account-Id': account.accountID,
          'User-Agent': 'openchamber-codex-reset-credits',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new Failure('CODEX_UNREACHABLE');
    }
    // Never forward upstream error bodies or headers to the panel or logs.
    if (!response.ok) {
      const code = response.status === 401 ? 'SIGN_IN_REQUIRED' : response.status === 403 ? 'ACCESS_DENIED' :
        response.status === 429 ? 'RATE_LIMITED' : response.status === 404 ? 'NOT_SUPPORTED' : 'CODEX_ERROR';
      throw new Failure(code);
    }
    try { return await response.json(); } catch { throw new Failure('INVALID_RESPONSE'); }
  }

  const creditsFor = async (account: Account) => parseCredits(await request(account));
  function annotate(account: Account, credits: Credit[]): Credit[] {
    return credits.map((credit) => {
      const redemption = attempts.get(key(account, credit.id));
      return redemption ? { ...credit, redemption } : credit;
    });
  }

  async function list(force = false): Promise<Snapshot> {
    if (loading) return loading;
    if (!force && cached && deps.now() - Date.parse(cached.fetchedAt) < 30_000) return cached;
    const started = revision;
    const operation: Promise<Snapshot> = (async () => {
      const accounts = await deps.accounts();
      const results = await Promise.all(accounts.map(async (account): Promise<AccountSnapshot> => {
        const visible = { id: account.id, label: account.label, active: account.active };
        try {
          const result = await creditsFor(account);
          return { ...visible, credits: annotate(account, result.credits), availableCount: result.availableCount, error: null };
        } catch (error) {
          return { ...visible, credits: null, availableCount: null, error: error instanceof Failure ? error.code : 'CODEX_ERROR' };
        }
      }));
      const snapshot = { fetchedAt: new Date(deps.now()).toISOString(), accounts: results };
      // Neither the cache nor concurrent callers may receive a pre-redemption snapshot.
      if (started !== revision) {
        loading = null;
        return list(true);
      }
      cached = snapshot;
      return snapshot;
    })().finally(() => { if (loading === operation) loading = null; });
    loading = operation;
    return operation;
  }

  async function redeem(body: unknown): Promise<RedeemResult> {
    const input = parseRedeemInput(body);
    const account = (await deps.accounts()).find((candidate) => candidate.id === input.credentialID);
    if (!account) throw new Failure('ACCOUNT_NOT_FOUND', 404);
    if (!account.accountID) throw new Failure('ACCOUNT_ID_MISSING', 409);
    const target = key(account, input.creditID);
    if (attempts.has(target)) throw new Failure('ALREADY_REQUESTED', 409);
    attempts.set(target, 'pending');
    cached = null;
    revision++;
    let sent = false;
    try {
      const { credits } = await creditsFor(account);
      const credit = credits.find((item) => item.id === input.creditID);
      if (!credit || !canRedeem(credit, deps.now())) throw new Failure('CREDIT_UNAVAILABLE', 409);
      sent = true;
      const response = await request(account, { credit_id: input.creditID, redeem_request_id: randomUUID() });
      const result = parseRedeemResult(response);
      attempts.set(target, 'requested');
      return result;
    } catch (error) {
      if (sent) {
        attempts.set(target, 'unknown');
        throw new Failure('REDEMPTION_UNKNOWN', 409);
      }
      attempts.delete(target);
      throw error;
    } finally {
      cached = null;
      revision++;
    }
  }

  return { list, redeem };
}
