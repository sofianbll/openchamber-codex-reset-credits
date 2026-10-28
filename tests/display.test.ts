import { describe, expect, test } from 'bun:test';
import { defaultPreferences, parsePreferences, sidebarAccounts } from '../src/display.ts';
import type { AccountSnapshot } from '../src/contracts.ts';

const account = (id: string, active = false, count = 0, error: string | null = null): AccountSnapshot => ({
  id, label: id, active, availableCount: error ? null : count, error,
  credits: error ? null : Array.from({ length: count }, (_, i) => ({ id: `${id}-${i}`, title: null, description: null, reset_type: 'weekly', status: 'available', granted_at: null, expires_at: null })),
});
const accounts = [account('error', true, 0, 'SIGN_IN_REQUIRED'), account('empty'), account('credits', false, 2), account('selected', true, 1), account('tie', false, 1)];
const ids = (items: AccountSnapshot[]) => items.map(item => item.id);

describe('display preferences and sidebar projection', () => {
  test('stable ordering keeps healthy active:false accounts and never mutates the snapshot', () => {
    expect(ids(sidebarAccounts(accounts, { ...defaultPreferences(), showUnavailable: true }).accounts)).toEqual(['selected', 'credits', 'tie', 'empty', 'error']);
    expect(ids(accounts)).toEqual(['error', 'empty', 'credits', 'selected', 'tie']);
  });
  test('only Mini + OFF filters errored accounts', () => {
    expect(ids(sidebarAccounts(accounts, defaultPreferences()).accounts)).toEqual(['selected', 'credits', 'tie', 'empty']);
    for (const sidebar of ['compact', 'tickets', 'mini'] as const) {
      const prefs = { ...defaultPreferences(), sidebar, showUnavailable: sidebar === 'mini' };
      expect(sidebarAccounts(accounts, prefs).accounts).toHaveLength(5);
    }
  });
  test('limit applies after filtering and sorting, disclosure reveals the remainder', () => {
    const prefs = { ...defaultPreferences(), limit: 2 };
    expect(ids(sidebarAccounts(accounts, prefs).accounts)).toEqual(['selected', 'credits']);
    expect(sidebarAccounts(accounts, prefs).extra).toBe(2);
    expect(sidebarAccounts(accounts, prefs, true).accounts).toHaveLength(4);
  });
  test('invalid or missing preferences fall back as one validated object', () => {
    for (const value of [undefined, null, {}, 'mini', { ...defaultPreferences(), sidebar: 'bad' }, { ...defaultPreferences(), limit: 0 }, { ...defaultPreferences(), limit: 1.5 }, { ...defaultPreferences(), limit: Infinity }, { ...defaultPreferences(), showUnavailable: 'false' }]) {
      expect(parsePreferences(value)).toEqual(defaultPreferences());
    }
    const valid = { sidebar: 'tickets', panelDefault: 'mini', showUnavailable: true, limit: 3 } as const;
    expect(parsePreferences(valid)).toEqual(valid);
  });
});
