import { connectHost, type HostReadyContext } from '@openchamber/sdk';
import { applyHostReady, mountButton, type ButtonHandle, type ButtonProps } from '@openchamber/sdk/ui';
import { canRedeem, isRecord, parseCredits, type AccountSnapshot, type Credit, type Snapshot } from './contracts.ts';
import { messages } from './i18n.ts';
import { icon, installIcons, type IconName } from './icons.ts';
import { availableCount, defaultPreferences, parsePreferences, sidebarAccounts, VIEWS, type DisplayPreferences, type View } from './display.ts';

const host = connectHost();
const root = document.querySelector<HTMLElement>('#root')!;
let context: HostReadyContext | null = null;
let locale = 'en';
let t = messages(locale);
let snapshot: Snapshot | null = null;
let loading = false;
let notice = '';
let confirmation: { account: AccountSnapshot; credit: Credit } | null = null;
let pending: string | null = null;
let buttons: ButtonHandle[] = [];
const expanded = new Map<string, boolean>();
const blocked = new Map<string, 'requested' | 'unknown'>();
const key = (account: AccountSnapshot, credit: Credit) => JSON.stringify([account.id, credit.id]);
let preferences = defaultPreferences();
let mode: View = 'compact';
let settingsOpen = false;
let showAllAccounts = false;
let open: string | null = null;
const history = new Set<string>();
let storageQueue = Promise.resolve();

// Keep the host storage scope/access in one place for panel + status frames.
async function displayStorage(next?: DisplayPreferences): Promise<DisplayPreferences> {
  try {
    if (next) await host.storage.set('display', next);
    return parsePreferences(next ?? await host.storage.get('display'));
  } catch { return defaultPreferences(); }
}

function savePreferences(next: DisplayPreferences) {
  preferences = next;
  storageQueue = storageQueue.then(async () => {
    const saved = await displayStorage(next);
    if (preferences === next) {
      preferences = saved;
      // Successful writes must not replace a field the user has started editing.
      if (JSON.stringify(saved) !== JSON.stringify(next)) render();
    }
  });
}

async function readPreferences(initial = false) {
  await storageQueue;
  const stored = await displayStorage();
  // A visibility refresh must not move or hide an explicit consumption confirmation.
  if (confirmation || pending) return;
  preferences = stored;
  if (context?.surface === 'status') mode = preferences.sidebar;
  else if (initial) mode = preferences.panelDefault;
  showAllAccounts = false;
  render();
}

function node<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') {
  const element = document.createElement(tag);
  element.textContent = text;
  element.className = className;
  return element;
}

function button(parent: HTMLElement, props: ButtonProps, focusKey: string): HTMLButtonElement {
  const slot = node('span', '', 'button-slot');
  parent.append(slot);
  buttons.push(mountButton(slot, { size: 'sm', ...props }));
  const result = slot.querySelector('button')!;
  result.dataset.focus = focusKey;
  return result;
}

function focus(key: string) {
  Array.from(root.querySelectorAll<HTMLElement>('[data-focus]')).find((item) => item.dataset.focus === key)?.focus();
}

function errorCode(error: unknown): string {
  return isRecord(error) && typeof error.code === 'string' ? error.code : 'REQUEST_FAILED';
}

function describeError(code: string): string {
  const text = code === 'SIGN_IN_REQUIRED' || code === 'ACCOUNT_ID_MISSING' ? t.auth :
    /PERMISSION|CAPABILITY|SERVICE_DISABLED|SERVICE_NOT|SERVICE_UNAVAILABLE/.test(code) || ['NOT_GRANTED', 'NO_SERVICE', 'DISABLED', 'DENIED'].includes(code) ? t.service :
    code === 'SQLITE_MISSING' ? t.sqlite : code.startsWith('DATABASE_') ? t.database :
    code === 'NOT_SUPPORTED' ? t.unsupported : code === 'ACCESS_DENIED' ? t.denied :
    code === 'RATE_LIMITED' ? t.limited : code === 'INVALID_RESPONSE' ? t.invalid :
    code === 'CODEX_UNREACHABLE' ? t.unreachable : code === 'CREDIT_UNAVAILABLE' ? t.unavailable :
    code === 'REDEMPTION_UNKNOWN' || code === 'ALREADY_REQUESTED' ? t.uncertain : t.failed;
  // Only expose bounded machine codes, never upstream messages or response bodies.
  return `${text}${/^[A-Z0-9_]{1,80}$/.test(code) ? ` (${code})` : ''}`;
}

function parseSnapshot(value: unknown): Snapshot {
  if (!isRecord(value) || typeof value.fetchedAt !== 'string' || !Number.isFinite(Date.parse(value.fetchedAt)) || !Array.isArray(value.accounts)) throw new Error('INVALID_RESPONSE');
  const accounts = value.accounts.map((item: unknown): AccountSnapshot => {
    if (!isRecord(item) || typeof item.id !== 'string' || typeof item.label !== 'string' || typeof item.active !== 'boolean' ||
      !(item.error === null || typeof item.error === 'string') ||
      !(item.availableCount === null || (Number.isSafeInteger(item.availableCount) && Number(item.availableCount) >= 0))) throw new Error('INVALID_RESPONSE');
    let credits: Credit[] | null = null;
    if (item.credits !== null) {
      credits = parseCredits({ credits: item.credits, available_count: item.availableCount ?? 0 }).credits;
      const raw = item.credits as Record<string, unknown>[];
      credits.forEach((credit, index) => {
        const state = raw[index]!.redemption;
        if (state !== undefined && state !== 'pending' && state !== 'requested' && state !== 'unknown') throw new Error('INVALID_RESPONSE');
        if (state) credit.redemption = state;
      });
    }
    return { id: item.id, label: item.label, active: item.active, error: item.error, availableCount: item.availableCount as number | null, credits };
  });
  return { fetchedAt: value.fetchedAt, accounts };
}

function date(value: string | null): string {
  if (value === null) return t.notProvided;
  try { return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return value; }
}

async function refresh(force = false) {
  if (loading || confirmation || pending) return;
  loading = true;
  render();
  try {
    const response = await host.serviceRequest({ method: 'GET', path: '/accounts', ...(force ? { query: { refresh: '1' } } : {}) });
    const body: unknown = JSON.parse(response.body);
    if (response.status < 200 || response.status >= 300) throw { code: isRecord(body) && typeof body.error === 'string' ? body.error : 'REQUEST_FAILED' };
    snapshot = parseSnapshot(body);
    for (const account of snapshot.accounts) if (!expanded.has(account.id)) expanded.set(account.id, account.active && !!availableCount(account));
    for (const account of snapshot.accounts) for (const credit of account.credits ?? []) {
      if (credit.redemption) blocked.delete(key(account, credit));
    }
    if (!notice.startsWith(t.response) && !notice.startsWith(t.uncertain)) notice = '';
  } catch (error) {
    notice = describeError(error instanceof SyntaxError || error instanceof Error && error.message === 'INVALID_RESPONSE' ? 'INVALID_RESPONSE' : errorCode(error));
  } finally {
    loading = false;
    render();
  }
}

function cancelConfirmation() {
  if (!confirmation || pending) return;
  const target = key(confirmation.account, confirmation.credit);
  confirmation = null;
  render();
  focus(`redeem:${target}`);
}

async function redeem(account: AccountSnapshot, credit: Credit) {
  if (pending || !confirmation || !canRedeem(credit) || blocked.has(key(account, credit))) return;
  const target = key(account, credit);
  pending = target;
  confirmation = null;
  render();
  try {
    const response = await host.serviceRequest({ method: 'POST', path: '/redeem', body: JSON.stringify({ credentialID: account.id, creditID: credit.id, confirmed: true }) });
    const body: unknown = JSON.parse(response.body);
    if (response.status < 200 || response.status >= 300) {
      const code = isRecord(body) && typeof body.error === 'string' ? body.error : 'REDEMPTION_UNKNOWN';
      if (code === 'REDEMPTION_UNKNOWN' || code === 'ALREADY_REQUESTED') blocked.set(target, 'unknown');
      notice = describeError(code);
    } else if (isRecord(body) && typeof body.code === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(body.code)) {
      blocked.set(target, 'requested');
      notice = `${t.response}: ${body.code}. ${t.requested}`;
      if (typeof body.windowsReset === 'number' && Number.isSafeInteger(body.windowsReset) && body.windowsReset >= 0) notice += ` ${t.windows}: ${body.windowsReset}.`;
    } else {
      blocked.set(target, 'unknown');
      notice = t.uncertain;
    }
  } catch {
    blocked.set(target, 'unknown');
    notice = t.uncertain;
  } finally {
    pending = null;
    render();
    focus('notice');
    await refresh(true);
  }
}

type Child = Node | string | null | undefined | false;
type State = 'available' | 'pending' | 'unknown' | 'used' | 'expired' | 'unavailable';
const RANK: Record<State, number> = { available: 0, pending: 1, unknown: 1, unavailable: 2, used: 3, expired: 3 };
const GLYPH: Record<State, IconName> = { available: 'reset', pending: 'clock', unknown: 'help', used: 'check', expired: 'hourglass', unavailable: 'alert' };
const typeLabel = (value: string) => value === 'codex_rate_limits' ? t.codexLimits : value.replaceAll('_', ' ');
const title = (credit: Credit) => credit.title || typeLabel(credit.reset_type);
const isAuthError = (account: AccountSnapshot) => /SIGN_IN|AUTH|TOKEN|401|ACCOUNT_ID_MISSING/.test(account.error ?? '');
const unavailableHint = (account: AccountSnapshot) => `${t.accountUnavailable} · ${isAuthError(account) ? t.auth : t.creditsUnavailable}`;
const daysLeft = (credit: Credit) => credit.expires_at ? Math.max(0, Math.floor((Date.parse(credit.expires_at) - Date.now()) / 86_400_000)) : null;
const daysText = (left: number) => `${left < 1 ? '<1' : left}${t.dayUnit}`;
const expiryHint = (left: number) => left < 1 ? t.expiresToday : `${t.expiresIn} ${left} ${t.days}`;
function day(value: string | null) {
  return value ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(value)) : '—';
}
function creditDate(value: string | null, glyph: IconName, label: string) {
  const element = h('span', 'date', icon(glyph), day(value));
  element.title = `${label}: ${date(value)}`;
  element.setAttribute('aria-label', element.title);
  return element;
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', ...children: Child[]) {
  const element = node(tag, '', className);
  for (const child of children) if (child) element.append(child);
  return element;
}

function toggle(className: string, shown: boolean, focusKey: string, change: () => void, ...children: Child[]) {
  const element = h('button', className, ...children);
  element.type = 'button';
  element.dataset.focus = focusKey;
  element.setAttribute('aria-expanded', String(shown));
  element.onclick = () => { change(); render(); focus(focusKey); };
  return element;
}

function stateOf(account: AccountSnapshot, credit: Credit): State {
  const target = key(account, credit);
  const redemption = pending === target ? 'pending' : credit.redemption ?? blocked.get(target);
  if (redemption) return redemption === 'unknown' ? 'unknown' : 'pending';
  if (['used', 'consumed', 'redeemed'].includes(credit.status)) return 'used';
  if (credit.status === 'expired' || credit.expires_at && Date.parse(credit.expires_at) <= Date.now()) return 'expired';
  return !account.error && canRedeem(credit) ? 'available' : 'unavailable';
}
function stateLabel(state: State) {
  return ({ available: t.availableState, pending: t.pendingState, unknown: t.verify, used: t.used, expired: t.expired, unavailable: t.unavailableState })[state];
}
function sorted(account: AccountSnapshot) {
  const expiry = (credit: Credit) => credit.expires_at ? Date.parse(credit.expires_at) : Infinity;
  return [...(account.credits ?? [])].sort((a, b) => RANK[stateOf(account, a)] - RANK[stateOf(account, b)] || expiry(a) - expiry(b));
}

function badge(account: AccountSnapshot) {
  const count = availableCount(account);
  if (account.error && context?.surface === 'status') {
    const dot = h('span', 'unavailable-dot', h('span', 'sr', unavailableHint(account)));
    dot.title = unavailableHint(account);
    return dot;
  }
  if (count === null && account.error) return h('span', 'badge warn', icon('login'), isAuthError(account) ? t.reconnect : t.unavailableState);
  // Unread is not an error: no reconnect hint, just an explicit unknown.
  if (count === null) { const unknown = h('span', 'badge', icon('ticket'), '?'); unknown.title = t.unknownResets; return unknown; }
  const element = h('span', `badge${count ? ' on' : ''}`, icon('ticket'), String(count), h('span', 'sr', ` ${t.available}`));
  element.title = `${count} ${t.available}`;
  return element;
}
function accountHeader(account: AccountSnapshot, showBadge: boolean, collapsible = true) {
  const shown = expanded.get(account.id) ?? false;
  const live = account.active && h('span', 'live', h('span', 'sr', t.active));
  if (live) live.title = t.selectedAccount;
  const children = [h('span', 'avatar', icon('user')), h('span', 'acct-name', account.label), live, showBadge && badge(account)];
  const header = collapsible ? toggle('acct-toggle', shown, `account:${account.id}`, () => {
    if (confirmation?.account.id !== account.id) expanded.set(account.id, !shown);
  }, icon('chevron'), ...children) : h('div', 'acct-header', ...children);
  header.title = account.error ? unavailableHint(account) : account.label;
  return header;
}
function accountNote(account: AccountSnapshot) {
  if (account.error) return context?.surface === 'status' ? null : h('p', 'note warn', icon('login'), describeError(account.error));
  if (account.credits === null) return h('p', 'note', icon('help'), t.unread);
  if (!account.credits.length) return h('p', 'note', icon('ticket'), t.noCredits);
  return null;
}
function dates(credit: Credit, state: State) {
  const left = state === 'available' ? daysLeft(credit) : null;
  const arrow = h('span', 'sep', '→');
  arrow.setAttribute('aria-hidden', 'true');
  const remaining = left !== null && h('span', `left${left <= 3 ? ' soon' : ''}`, daysText(left));
  if (remaining) remaining.title = expiryHint(left!);
  return h('span', 'dates', creditDate(credit.granted_at, 'gift', t.obtained), arrow,
    creditDate(credit.expires_at, 'hourglass', t.expires), remaining);
}
function action(account: AccountSnapshot, credit: Credit, state: State, withLabel: boolean) {
  const target = key(account, credit);
  if (state !== 'available') {
    const element = h('button', `state is-${state}`, icon(GLYPH[state]), stateLabel(state));
    element.type = 'button';
    element.disabled = true;
    element.dataset.focus = `redeem:${target}`;
    const redemption = credit.redemption ?? blocked.get(target);
    element.title = state === 'unknown' ? t.uncertain : redemption === 'requested' ? t.requested : stateLabel(state);
    element.setAttribute('aria-label', `${title(credit)} · ${element.title}`);
    return element;
  }
  const element = h('button', withLabel ? 'act wide' : 'act', icon('reset'), withLabel && t.use);
  element.type = 'button';
  element.title = t.useReset;
  element.setAttribute('aria-label', `${t.use} ${title(credit)} ${t.onAccount} ${account.label}`);
  element.dataset.focus = `redeem:${target}`;
  element.disabled = loading || !!confirmation || !!pending;
  element.onclick = () => { expanded.set(account.id, true); open = target; confirmation = { account, credit }; render(); focus('cancel'); };
  return element;
}
function details(credit: Credit, withDescription: boolean) {
  const id = h('code', 'credit-id', credit.id);
  id.title = credit.id;
  id.tabIndex = 0;
  id.setAttribute('aria-label', `${t.identifier}: ${credit.id}`);
  return h('div', 'details', withDescription && credit.description && h('p', 'desc', credit.description),
    h('dl', 'meta', h('dt', '', t.type), h('dd', '', typeLabel(credit.reset_type)), h('dt', '', t.identifier), h('dd', '', id)));
}
function confirmBox(account: AccountSnapshot, credit: Credit) {
  const actions = h('div', 'confirm-actions');
  const box = h('div', 'confirm confirmation', h('p', 'confirm-title', icon('reset'), t.confirming),
    h('p', 'confirm-sub', `${account.label} — ${title(credit)}`), h('p', 'confirm-sub', t.warning), actions);
  box.setAttribute('role', 'group');
  box.setAttribute('aria-label', t.confirming);
  button(actions, { label: t.cancel, variant: 'outline', onClick: cancelConfirmation }, 'cancel');
  button(actions, { label: t.confirm, variant: 'destructive', onClick: () => void redeem(account, credit) }, 'confirm');
  return box;
}
const confirming = (account: AccountSnapshot, credit: Credit) => confirmation && key(confirmation.account, confirmation.credit) === key(account, credit);
function row(account: AccountSnapshot, credit: Credit) {
  const target = key(account, credit), state = stateOf(account, credit);
  const main = toggle('row-main', open === target, `more:${target}`, () => { open = open === target ? null : target; },
    h('span', 'row-title', h('span', '', title(credit)), icon('info')), dates(credit, state));
  return h('div', `row is-${state}`, h('span', 'tile', icon('ticket')), main, action(account, credit, state, false),
    open === target && details(credit, true), confirming(account, credit) && confirmBox(account, credit));
}
function ring(credit: Credit, state: State) {
  const left = state === 'available' ? daysLeft(credit) : null;
  if (left === null) return null;
  const span = credit.granted_at ? Date.parse(credit.expires_at!) - Date.parse(credit.granted_at) : 0;
  const fraction = span > 0 ? Math.min(1, Math.max(0.04, (Date.parse(credit.expires_at!) - Date.now()) / span)) : 1;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 36 36');
  svg.setAttribute('aria-hidden', 'true');
  for (const [name, dash] of [['track', ''], ['value', `${(fraction * 94.25).toFixed(2)} 94.25`]] as const) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    for (const [attribute, value] of Object.entries({ cx: '18', cy: '18', r: '15', class: name })) circle.setAttribute(attribute, value);
    if (dash) circle.setAttribute('stroke-dasharray', dash);
    svg.append(circle);
  }
  const element = h('span', `ring${left <= 3 ? ' soon' : ''}`, svg, h('b', '', daysText(left)));
  element.title = expiryHint(left);
  return element;
}
function coupon(account: AccountSnapshot, credit: Credit) {
  const target = key(account, credit), state = stateOf(account, credit);
  const info = toggle('info-btn', open === target, `more:${target}`, () => { open = open === target ? null : target; }, icon('info'));
  info.setAttribute('aria-label', `${t.detailsOf} ${title(credit)}`);
  return h('div', 'coupon-wrap', h('article', `coupon is-${state}`, h('span', 'coupon-art', icon('art')),
    h('div', 'coupon-body', h('div', 'coupon-head', h('span', 'coupon-title', title(credit)), ring(credit, state)),
      h('p', 'coupon-sub', typeLabel(credit.reset_type)), credit.description && h('p', 'coupon-desc', credit.description)),
    h('div', 'coupon-foot', creditDate(credit.granted_at, 'gift', t.obtained),
      creditDate(credit.expires_at, 'hourglass', t.expires), info, action(account, credit, state, true))),
    open === target && details(credit, false), confirming(account, credit) && confirmBox(account, credit));
}
function stub(account: AccountSnapshot, credit: Credit) {
  const target = key(account, credit), state = stateOf(account, credit), left = state === 'available' ? daysLeft(credit) : null;
  const element = h('button', `stub is-${state}${left !== null && left <= 3 ? ' soon' : ''}`,
    h('span', 'stub-shape', icon(GLYPH[state]), h('span', 'stub-days', left === null ? '' : daysText(left))));
  const label = `${title(credit)} · ${stateLabel(state)} · ${t.expires} ${credit.expires_at ? day(credit.expires_at) : t.notProvided}`;
  element.type = 'button';
  element.title = label;
  element.dataset.focus = `stub:${target}`;
  element.setAttribute('aria-label', label);
  element.setAttribute('aria-pressed', String(open === target));
  element.onclick = () => { if (confirmation) return; open = open === target ? null : target; render(); focus(`stub:${target}`); };
  return element;
}
function withHistory(account: AccountSnapshot) {
  const credits = sorted(account), past = credits.filter(credit => RANK[stateOf(account, credit)] === 3);
  const draw = (credit: Credit) => (mode === 'tickets' ? coupon : row)(account, credit);
  const current = credits.filter(credit => !past.includes(credit)).map(draw);
  if (!past.length) return current;
  const used = past.filter(credit => stateOf(account, credit) === 'used').length;
  const label = [used && `${used} ${t.usedCount}`, past.length - used && `${past.length - used} ${t.expiredCount}`].filter(Boolean).join(' · ');
  const shown = history.has(account.id);
  return [...current, toggle('history', shown, `history:${account.id}`, () => shown ? history.delete(account.id) : history.add(account.id), icon('check'), label, icon('chevron')),
    ...(shown ? past.map(draw) : [])];
}
function listAccount(account: AccountSnapshot) {
  return h('section', 'acct', accountHeader(account, true), expanded.get(account.id) && h('div', 'acct-body',
    accountNote(account) ?? h('div', mode === 'tickets' ? 'coupons' : 'list', ...withHistory(account))));
}
function miniAccount(account: AccountSnapshot) {
  const credits = account.error ? [] : sorted(account).filter(credit => RANK[stateOf(account, credit)] < 3);
  const selected = credits.find(credit => open === key(account, credit));
  const header = accountHeader(account, !credits.length, false);
  if (!credits.length) {
    const note = accountNote(account)?.textContent;
    if (note) { header.title = note; header.append(h('span', 'sr', note)); }
  }
  return h('section', 'acct', h('div', 'mini-line', header, !!credits.length && h('div', 'stubs', ...credits.map(credit => stub(account, credit)))),
    context?.surface !== 'status' && !!account.error && accountNote(account), selected && h('div', 'mini-detail', row(account, selected)));
}

function displayField(id: string, text: string, value: View, change: (next: View) => void) {
  const select = h('select');
  select.id = id;
  select.dataset.focus = id;
  for (const mode of VIEWS) { const option = h('option', '', t[mode]); option.value = mode; select.append(option); }
  select.value = value;
  select.onchange = () => { if (VIEWS.includes(select.value as View)) change(select.value as View); };
  const label = h('label', '', text); label.htmlFor = id;
  return h('div', 'settings-field', label, select);
}
function panelControls() {
  const gear = toggle('settings-toggle', settingsOpen, 'settings-toggle', () => { settingsOpen = !settingsOpen; }, icon(settingsOpen ? 'close' : 'settings'));
  gear.setAttribute('aria-label', settingsOpen ? t.closeSettings : t.settings);
  gear.setAttribute('aria-controls', 'display-settings');
  gear.title = gear.getAttribute('aria-label')!;
  const offline = h('input');
  offline.type = 'checkbox'; offline.id = 'show-unavailable'; offline.dataset.focus = offline.id;
  offline.checked = preferences.showUnavailable;
  offline.setAttribute('aria-label', t.showUnavailableHint);
  offline.onchange = () => savePreferences({ ...preferences, showUnavailable: offline.checked });
  const limit = h('input');
  limit.type = 'number'; limit.id = 'sidebar-account-limit'; limit.dataset.focus = limit.id;
  limit.min = '1'; limit.step = '1'; limit.placeholder = t.all; limit.value = preferences.limit === null ? '' : String(preferences.limit);
  limit.setAttribute('aria-label', t.accountsLimit);
  limit.onchange = () => {
    if (limit.validity.badInput || limit.value !== '' && (!/^[1-9]\d*$/.test(limit.value) || !Number.isSafeInteger(Number(limit.value)))) {
      limit.setCustomValidity(t.positiveLimit); limit.reportValidity(); return;
    }
    limit.setCustomValidity(''); savePreferences({ ...preferences, limit: limit.value === '' ? null : Number(limit.value) });
  };
  limit.oninput = () => limit.setCustomValidity('');
  const offlineLabel = h('label', '', t.showUnavailable); offlineLabel.htmlFor = offline.id;
  const limitLabel = h('label', '', t.accountsShown); limitLabel.htmlFor = limit.id;
  const settings = h('div', 'settings',
    displayField('sidebar-display', t.sidebarView, preferences.sidebar, sidebar => savePreferences({ ...preferences, sidebar })),
    displayField('panel-default-display', t.panelDefault, preferences.panelDefault, panelDefault => savePreferences({ ...preferences, panelDefault })),
    h('div', 'settings-field', limitLabel, limit), h('div', 'settings-field', offlineLabel, offline));
  settings.id = 'display-settings'; settings.hidden = !settingsOpen;
  const modes = h('div', 'display-modes'); modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', t.display);
  for (const view of VIEWS) {
    const element = h('button', '', t[view]); element.type = 'button'; element.dataset.focus = `mode:${view}`;
    element.setAttribute('aria-pressed', String(mode === view)); element.disabled = !!confirmation || !!pending;
    element.onclick = () => { mode = view; open = null; render(); focus(`mode:${view}`); };
    modes.append(element);
  }
  const refreshButton = h('button', 'settings-toggle', icon('reset'));
  refreshButton.type = 'button'; refreshButton.dataset.focus = 'refresh';
  refreshButton.title = t.refresh; refreshButton.setAttribute('aria-label', t.refresh);
  refreshButton.disabled = loading || !!confirmation || !!pending;
  refreshButton.onclick = () => void refresh(true);
  return h('div', 'panel-controls', h('div', 'settings-bar', refreshButton, gear, settings), modes);
}

function render() {
  const previousFocus = (document.activeElement as HTMLElement | null)?.dataset.focus;
  buttons.forEach(handle => handle.dispose()); buttons = [];
  const status = context?.surface === 'status';
  const view = h('div', `cr mode-${mode}`, !status && panelControls());
  root.setAttribute('aria-label', t.title);
  if (notice) {
    const message = h('p', 'notice', icon('alert'), notice);
    message.setAttribute('role', 'status'); message.tabIndex = -1; message.dataset.focus = 'notice'; view.append(message);
  }
  if (!snapshot) view.append(h('p', 'note', icon('clock'), loading ? t.loading : t.unknown));
  else if (!snapshot.accounts.length) view.append(h('p', 'note', icon('user'), t.noAccounts));
  else {
    const selection = status ? sidebarAccounts(snapshot.accounts, preferences, showAllAccounts) : { accounts: snapshot.accounts, extra: 0 };
    view.append(...selection.accounts.map(account => (mode === 'mini' ? miniAccount : listAccount)(account)));
    if (!selection.accounts.length) view.append(h('p', 'note', icon('alert'), t.hiddenAccounts));
    if (selection.extra) view.append(toggle('accounts-more', showAllAccounts, 'accounts-more', () => { showAllAccounts = !showAllAccounts; },
      showAllAccounts ? t.reduceAccounts : `+${selection.extra} ${selection.extra === 1 ? t.moreAccount : t.moreAccounts}`, icon('chevron')));
  }
  if (status) {
    const footer = h('div', 'footer status-footer');
    const refreshButton = h('button', 'status-action', icon('reset'));
    refreshButton.type = 'button'; refreshButton.dataset.focus = 'refresh';
    refreshButton.title = t.refresh; refreshButton.setAttribute('aria-label', t.refresh);
    refreshButton.disabled = loading || !!confirmation || !!pending;
    refreshButton.onclick = () => void refresh(true);
    const link = h('button', 'status-action', icon('panel'));
    link.type = 'button'; link.dataset.focus = 'view-panel';
    link.title = t.viewPanel; link.setAttribute('aria-label', t.viewPanel);
    link.onclick = () => { void host.openSurface('plugin:codex-reset-credits').catch(() => undefined); };
    footer.append(refreshButton, link); view.append(footer);
  } else {
    if (snapshot) view.append(h('p', 'footnote', `${t.updated}: ${date(snapshot.fetchedAt)}`));
    view.append(h('p', 'footnote', t.footnote));
  }
  root.replaceChildren(view);
  if (previousFocus) focus(previousFocus);
}

root.append(node('p', t.loading, 'empty muted'));
host.onReady((ready) => {
  const first = context === null;
  context = ready;
  applyHostReady(ready, document.documentElement);
  locale = ready.locale;
  t = messages(locale);
  document.documentElement.lang = locale;
  if (first) void readPreferences(true).then(() => refresh());
  // Theme/reconnection messages must not remount controls or interrupt confirmation.
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && settingsOpen) { event.preventDefault(); settingsOpen = false; render(); focus('settings-toggle'); return; }
  if (event.key === 'Escape' && confirmation) { event.preventDefault(); cancelConfirmation(); }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && context) void readPreferences().then(() => refresh(true));
});
document.addEventListener('pointerdown', event => {
  if (!settingsOpen || !(event.target instanceof Element) || event.target.closest('.settings, .settings-toggle')) return;
  settingsOpen = false;
  const settings = root.querySelector<HTMLElement>('#display-settings');
  if (settings) settings.hidden = true;
  const gear = root.querySelector<HTMLElement>('.settings-toggle');
  if (gear) { gear.setAttribute('aria-expanded', 'false'); gear.setAttribute('aria-label', t.settings); gear.title = t.settings; gear.replaceChildren(icon('settings')); }
});
installIcons();
let lastHeight = 0;
new ResizeObserver(() => {
  if (context?.surface !== 'status') return;
  const height = Math.ceil(root.getBoundingClientRect().height);
  if (height !== lastHeight) {
    lastHeight = height;
    void host.setHeight(height).catch(() => undefined);
  }
}).observe(root);
