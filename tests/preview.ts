// Isolated synthetic host. Never imports service code or reads credentials.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canRedeem, type Snapshot } from '../src/contracts.ts';

const base = fileURLToPath(new URL('..', import.meta.url));
const bundle = await Bun.build({ entrypoints: [join(base, 'src/panel.ts')], target: 'browser', format: 'iife' });
if (!bundle.success) throw new Error(bundle.logs.join('\n'));
const script = await bundle.outputs[0]!.text();
const credit = {
  id: 'synthetic-credit', reset_type: 'weekly', status: 'available', title: 'Synthetic weekly reset',
  description: 'Synthetic credit for UI checks only. No real account or consumption.',
  granted_at: '2026-10-20T10:00:00Z', expires_at: null,
};
const fixtures: Record<string, Snapshot> = {
  confirm: { fetchedAt: '2026-10-28T10:00:00Z', accounts: [
    { id: 'synthetic-account', label: 'Synthetic ChatGPT account', active: true, availableCount: 1, error: null, credits: [credit] },
  ] },
  empty: { fetchedAt: '2026-10-28T10:00:00Z', accounts: [] },
  errors: { fetchedAt: '2026-10-28T10:00:00Z', accounts: [
    { id: 'synthetic-auth', label: 'Synthetic signed-out account', active: true, availableCount: null, credits: null, error: 'SIGN_IN_REQUIRED' },
    { id: 'synthetic-empty', label: 'Synthetic account without credits', active: false, availableCount: 0, credits: [], error: null },
  ] },
  long: { fetchedAt: '2026-10-28T10:00:00Z', accounts: [
    { id: 'synthetic-long', label: 'Synthetic-account-with-a-very-long-unbroken-label-'.repeat(5), active: true, availableCount: 1, error: null,
      credits: [{ ...credit, title: 'Very-long-synthetic-credit-title-'.repeat(8), description: 'VeryLongSyntheticDescription'.repeat(25) }] },
  ] },
  pending: { fetchedAt: '2026-10-28T10:00:00Z', accounts: [
    { id: 'synthetic-pending', label: 'Synthetic pending account', active: false, availableCount: 1, error: null, credits: [{ ...credit, redemption: 'unknown' }] },
  ] },
};
fixtures.multi = { fetchedAt: fixtures.confirm!.fetchedAt, accounts: [
  ...fixtures.confirm!.accounts, ...fixtures.errors!.accounts.map((account) => ({ ...account, active: false })),
] };
// Same fields and wording as the live Codex answer; IDs and dates are synthetic.
const fullReset = { ...credit, title: 'Full reset', reset_type: 'codex_rate_limits',
  description: "Thanks for using Codex! You've been granted one free rate limit reset." };
fixtures.design = { fetchedAt: fixtures.confirm!.fetchedAt, accounts: [
  { id: 'demo-pro', label: 'Codex Pro', active: true, availableCount: 2, totalEarned: 3, error: null, credits: [
    { ...fullReset, id: 'RateLimitResetCredit_5f1c0a9e2b7d4c6f8a3e1b0d9c7a6f21', granted_at: '2026-10-08T00:00:00Z', expires_at: '2026-11-07T00:00:00Z' },
    { ...fullReset, id: 'RateLimitResetCredit_0b9e7d1c3a5f48e2b6c4d0a8f1e3c5b7', granted_at: '2026-10-25T12:00:00Z', expires_at: '2026-10-31T12:00:00Z' },
    { ...fullReset, id: 'RateLimitResetCredit_9a8b7c6d5e4f40312a1b0c9d8e7f6a5b', status: 'used', granted_at: '2026-09-10T00:00:00Z', expires_at: '2026-10-10T00:00:00Z' },
  ] },
  { id: 'demo-plus', label: 'Codex Plus', active: false, availableCount: 1, totalEarned: 2, error: null, credits: [
    { ...fullReset, id: 'RateLimitResetCredit_c3d2e1f0a9b84c7d6e5f4a3b2c1d0e9f', granted_at: '2026-10-20T10:00:00Z', expires_at: '2026-11-19T10:00:00Z' },
    { ...fullReset, id: 'RateLimitResetCredit_1e2d3c4b5a6948f7e6d5c4b3a2f1e0d9', status: 'used', granted_at: '2026-10-01T10:00:00Z', expires_at: '2026-10-31T10:00:00Z' },
  ] },
  { id: 'demo-auth', label: 'Compte secondaire', active: false, availableCount: null, error: 'SIGN_IN_REQUIRED', credits: null },
] } as Snapshot;
fixtures.ordering = { fetchedAt: fixtures.design.fetchedAt, accounts: [
  { ...fixtures.design.accounts[2]!, id: 'ordering-auth', label: 'Session expirée' },
  { id: 'ordering-empty', label: 'Compte sans reset', active: false, availableCount: 0, error: null, credits: [] },
  fixtures.design.accounts[1]!,
  { ...fixtures.design.accounts[2]!, id: 'ordering-rate', label: 'Compte limité', error: 'RATE_LIMITED' },
  { id: 'ordering-unknown', label: 'Compte non lu', active: false, availableCount: null, error: null, credits: null },
  fixtures.design.accounts[0]!,
] };
fixtures.all_unavailable = { fetchedAt: fixtures.design.fetchedAt, accounts: [
  { ...fixtures.design.accounts[2]!, id: 'offline-active', label: 'Compte sélectionné expiré', active: true },
  { ...fixtures.design.accounts[2]!, id: 'offline-other', label: 'Autre compte expiré' },
] };

// Small fixture self-check: unknown counts and pending states must never become redeemable zeroes.
if (fixtures.errors!.accounts[0]!.availableCount !== null || !canRedeem(credit) || canRedeem({ ...credit, redemption: 'unknown' })) {
  throw new Error('Unsafe preview fixture');
}

function preview(url: URL) {
  const fixture = fixtures[url.searchParams.get('fixture') ?? 'confirm'] ?? fixtures.confirm!;
  const surface = url.searchParams.get('surface') === 'status' ? 'status' : 'panel';
  const locale = url.searchParams.get('locale') === 'en' ? 'en' : 'fr';
  const width = Math.max(260, Math.min(720, Number(url.searchParams.get('width')) || 720));
  const modes = ['compact', 'tickets', 'mini'];
  const panelDefault = modes.includes(url.searchParams.get('default') ?? '') ? url.searchParams.get('default')! : 'compact';
  const requestedLimit = url.searchParams.get('limit');
  const visibility = {
    offline: url.searchParams.get('offline') === '1',
    limit: requestedLimit !== null && requestedLimit.trim() !== '' && Number.isSafeInteger(Number(requestedLimit)) && Number(requestedLimit) > 0
      ? Number(requestedLimit) : null,
  };
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Synthetic Codex preview</title>
  <style>body { margin:0; background:#fafafa; font:14px system-ui; } iframe { width:100%; max-width:${width}px; height:850px; border:0; display:block; } nav { padding:8px; } button { margin:4px; }</style></head>
  <body><nav>Synthetic data only <button id="theme">Host ready/theme update</button><button id="check">Check rendered UI</button><button id="exercise">Test confirmation flow</button><output id="result"></output></nav>
  <iframe title="Synthetic extension" src="/panel/index.html"></iframe><script>
  const frame = document.querySelector('iframe');
  const fixture = ${JSON.stringify(fixture)};
  const storage = new Map([['display', {sidebar:${JSON.stringify(url.searchParams.get('sidebar') ?? 'mini')},panelDefault:${JSON.stringify(panelDefault)},showUnavailable:${visibility.offline},limit:${JSON.stringify(visibility.limit)}}]]);
  let requests = 0;
  const payload = {
    theme: { mode:'light', tokens: {
      background:'#fafafa', elevated:'#ffffff', foreground:'#202124', muted:'#62666c', subtle:'#eeeeee', border:'#dedee0', hover:'#ededed',
      selection:'#e0eaff', focus:'#4268c8', primary:'#4268c8', font:'system-ui, sans-serif', mutedSurface:'#eeeeef', elevatedForeground:'#202124',
      active:'#dddddf', selectionForeground:'#202124', primaryForeground:'#ffffff', primaryText:'#2a50ab', successText:'#1b703b', warningText:'#8a5909',
      errorText:'#a32626', infoText:'#2a50ab', success:'#1b703b', warning:'#8a5909', error:'#a32626', info:'#2a50ab', mono:'monospace', radius:'6px'
    } }, locale:${JSON.stringify(locale)}, directory:null, session:null, surface:${JSON.stringify(surface)}, connection:{ connected:false, account:'' }, settings:{}, item:null
  };
  const lightTheme = payload.theme;
  // Palette from OpenChamber's openchamber-dark.json; production always uses host tokens.
  const darkTheme = { mode:'dark', tokens:{ ...lightTheme.tokens,
    background:'#120f0e', elevated:'#1b1918', foreground:'#dbd7cc', muted:'#949187', subtle:'#171616', border:'#242323bf',
    hover:'#ffffff0f', selection:'#c8c6c52b', focus:'#da7c4755', primary:'#da7c47', mutedSurface:'#0e0c0b', elevatedForeground:'#dbd7cc',
    active:'#ffffff1a', selectionForeground:'#dbd7cc', primaryForeground:'#120f0e', primaryText:'#da7c47',
    successText:'#76ad4f', warningText:'#c67f13', errorText:'#da5b4a', infoText:'#479fe6',
    success:'#76ad4f', warning:'#c67f13', error:'#da5b4a', info:'#479fe6'
  } };
  if(${JSON.stringify(url.searchParams.get('theme') === 'dark')}) payload.theme = darkTheme;
  const paintHost = () => {
    document.body.style.background = payload.theme.tokens.background; document.body.style.color = payload.theme.tokens.foreground;
  };
  paintHost();
  const send = (message) => frame.contentWindow.postMessage({ channel:'openchamber.sdk', v:1, ...message }, location.origin);
  const ready = () => send({type:'ready', payload});
  window.addEventListener('message', (event) => {
    if(event.source !== frame.contentWindow) return;
    if(event.data?.channel !== 'openchamber.sdk') return;
    const message = event.data;
    if(message.type === 'hello') { ready(); return; }
    if(message.type === 'resize') { if(payload.surface === 'status') frame.style.height = Math.max(50, Math.min(1200, message.payload.height)) + 'px'; }
    if(!message.id) return;
    if(message.type === 'storage') {
      const {op,key,value} = message.payload;
      if(op === 'set') storage.set(key,value);
      send({type:'result', id:message.id, ok:true, payload: op === 'get' ? {storage:true,op,found:storage.has(key),...(storage.has(key)?{value:storage.get(key)}:{})} : {storage:true,op}});
      return;
    }
    if(message.type === 'service-request') {
      if(${JSON.stringify(url.searchParams.get('fixture'))} === 'grant') { send({type:'result', id:message.id, ok:false, code:'NOT_GRANTED', error:'Synthetic grant required'}); return; }
      if(message.payload.method === 'POST') {
        requests++;
        const uncertain = ${JSON.stringify(url.searchParams.get('result') === 'unknown')};
        for(const account of fixture.accounts) for(const credit of account.credits ?? []) credit.redemption = uncertain ? 'unknown' : 'requested';
        send({type:'result', id:message.id, ok:true, payload:{status:uncertain?409:200, body:JSON.stringify(uncertain?{error:'REDEMPTION_UNKNOWN'}:{code:'synthetic_unverified_code',windowsReset:2})}});
      } else send({type:'result', id:message.id, ok:true, payload:{status:200,body:JSON.stringify(fixture)}});
    } else send({type:'result',id:message.id,ok:true});
  });
  // ?click=<selector> (repeatable) replays clicks inside the frame, for screenshots.
  const clicks = new URLSearchParams(location.search).getAll('click');
  if(clicks.length) frame.addEventListener('load', () => setTimeout(() => { for(const selector of clicks) frame.contentDocument.querySelector(selector)?.click(); }, 500));
  document.querySelector('#theme').onclick = () => { payload.theme = payload.theme.mode === 'dark' ? lightTheme : darkTheme; paintHost(); ready(); };
  const check = document.querySelector('#check');
  if(check) check.onclick = () => {
    const doc = frame.contentDocument;
    const failures = [];
    if(doc.documentElement.scrollWidth > frame.clientWidth) failures.push('horizontal overflow');
    const confirmation = doc.querySelector('.confirmation');
    if(confirmation && doc.activeElement?.dataset.focus !== 'cancel') failures.push('cancel not focused');
    if(requests > 1) failures.push('duplicate consumption');
    document.querySelector('#result').textContent = failures.length ? failures.join(', ') : 'PASS: layout, focus, request count ('+requests+')';
  };
  const exercise = document.querySelector('#exercise');
  if(exercise) exercise.onclick = async () => {
    const doc = frame.contentDocument;
    const tick = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const find = name => Array.from(doc.querySelectorAll('[data-focus]')).find(item => item.dataset.focus.startsWith(name));
    try {
      const details = doc.querySelector('details');
      if(details) details.open = true;
      const redeem = find('redeem:');
      if(!redeem || redeem.disabled) throw Error('No redeemable synthetic credit');
      redeem.click();
      if(doc.activeElement?.dataset.focus !== 'cancel') throw Error('Cancel not focused');
      const before = doc.querySelector('.confirmation');
      ready(); await tick();
      if(before !== doc.querySelector('.confirmation') || doc.activeElement?.dataset.focus !== 'cancel') throw Error('Host update lost confirmation/focus');
      if(!find('refresh').disabled || requests !== 0) throw Error('Unsafe confirmation state');
      doc.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true}));
      if(doc.querySelector('.confirmation') || !doc.activeElement?.dataset.focus.startsWith('redeem:')) throw Error('Escape did not restore focus');
      find('redeem:').click();
      find('confirm').click();
      await tick(); await tick();
      if(requests !== 1 || !find('redeem:').disabled) throw Error('Redemption not locked');
      document.querySelector('#result').textContent = 'PASS: cancel focus, host update, Escape, one synthetic POST, locked action';
    } catch(error) { document.querySelector('#result').textContent = 'FAIL: '+error.message; }
  };
  </script></body></html>`;
}

const server = Bun.serve({ hostname: '127.0.0.1', port: Number(process.env.PORT ?? 4178), fetch(request) {
  const url = new URL(request.url);
  if (url.pathname === '/panel/main.js') return new Response(script, { headers: { 'Content-Type': 'text/javascript' } });
  if (url.pathname === '/panel/style.css') return new Response(Bun.file(join(base, 'panel/style.css')));
  if (url.pathname === '/panel/index.html') return new Response(Bun.file(join(base, 'panel/index.html')));
  if (url.pathname !== '/') return new Response('Not found', { status: 404 });
  return new Response(preview(url), { headers: { 'Content-Type': 'text/html' } });
} });
console.log(`Synthetic UI preview: ${server.url}?fixture=confirm (multi, empty, errors, long, pending, design, ordering, all_unavailable, grant; surface=status; result=unknown; theme=dark)`);
