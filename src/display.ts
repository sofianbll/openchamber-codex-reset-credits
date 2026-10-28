import { canRedeem, isRecord, type AccountSnapshot } from './contracts.ts';

export const VIEWS = ['compact', 'tickets', 'mini'] as const;
export type View = typeof VIEWS[number];
export type DisplayPreferences = { sidebar: View; panelDefault: View; showUnavailable: boolean; limit: number | null };
export const defaultPreferences = (): DisplayPreferences => ({ sidebar: 'mini', panelDefault: 'compact', showUnavailable: false, limit: null });

export function parsePreferences(value: unknown): DisplayPreferences {
  if (!isRecord(value) || !VIEWS.includes(value.sidebar as View) || !VIEWS.includes(value.panelDefault as View) ||
    typeof value.showUnavailable !== 'boolean' || !(value.limit === null || Number.isSafeInteger(value.limit) && Number(value.limit) > 0)) return defaultPreferences();
  return { sidebar: value.sidebar as View, panelDefault: value.panelDefault as View, showUnavailable: value.showUnavailable, limit: value.limit as number | null };
}

export function availableCount(account: AccountSnapshot, now = Date.now()): number | null {
  if (account.error || account.availableCount === null || account.credits === null) return null;
  return account.credits.filter(credit => canRedeem(credit, now)).length;
}

export function sidebarAccounts(accounts: readonly AccountSnapshot[], prefs: DisplayPreferences, showAll = false, now = Date.now()) {
  const rank = (account: AccountSnapshot) => account.error ? 3 : account.active ? 0 : availableCount(account, now) ? 1 : 2;
  const ordered = accounts.filter(account => !(prefs.sidebar === 'mini' && !prefs.showUnavailable && account.error))
    .sort((a, b) => rank(a) - rank(b));
  const extra = prefs.limit === null ? 0 : Math.max(0, ordered.length - prefs.limit);
  return { accounts: showAll || prefs.limit === null ? ordered : ordered.slice(0, prefs.limit), extra };
}
