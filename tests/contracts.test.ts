import { describe, expect, test } from 'bun:test';
import { canRedeem, Failure, parseCredits, parseRedeemInput, parseRedeemResult } from '../src/contracts.ts';

const credit = { id: 'credit-1', status: 'available', reset_type: 'codex' };

describe('credit contracts', () => {
  test('preserves unknown statuses and normalizes absent optional fields', () => {
    expect(parseCredits({ available_count: 2, credits: [{ ...credit, status: 'future_status' }] })).toEqual({
      availableCount: 2,
      credits: [{ ...credit, status: 'future_status', title: null, description: null, granted_at: null, expires_at: null }],
    });
    expect(parseCredits({ available_count: 0, credits: [{ ...credit, granted_at: null, expires_at: null }] }).credits[0]?.expires_at).toBeNull();
  });

  test.each([
    null, [], {}, { credits: [], available_count: -1 }, { credits: [], available_count: 0.5 },
    { credits: [], available_count: '1' }, { credits: [credit, credit], available_count: 2 },
    ...[{ id: '' }, { status: '' }, { reset_type: '' }, { expires_at: 'not-a-date' },
      { granted_at: 123 }, { title: {} }, { description: 'x'.repeat(10001) }]
      .map((override) => ({ credits: [{ ...credit, ...override }], available_count: 1 })),
    { credits: Array.from({ length: 1001 }, (_, i) => ({ ...credit, id: String(i) })), available_count: 1001 },
  ].map((payload) => ({ payload })))('rejects malformed credit payload %#', ({ payload }) => {
    expect(() => parseCredits(payload)).toThrow(Failure);
  });

  test('expiry is exclusive and redemption locks or unknown statuses prevent consuming', () => {
    const now = Date.parse('2026-10-28T12:00:00Z');
    const parsed = parseCredits({ credits: [credit], available_count: 1 }).credits[0]!;
    expect(canRedeem(parsed, now)).toBe(true);
    for (const offset of [-1, 0, 1]) {
      expect(canRedeem({ ...parsed, expires_at: new Date(now + offset).toISOString() }, now)).toBe(offset > 0);
    }
    expect(canRedeem({ ...parsed, status: 'future_status' }, now)).toBe(false);
    for (const redemption of ['pending', 'requested', 'unknown'] as const) {
      expect(canRedeem({ ...parsed, redemption }, now)).toBe(false);
    }
  });

  test('redemption requires explicit confirmation and safe result fields', () => {
    expect(parseRedeemInput({ credentialID: 'a', creditID: 'b', confirmed: true })).toEqual({ credentialID: 'a', creditID: 'b', confirmed: true });
    for (const input of [null, {}, { credentialID: 'a', creditID: 'b', confirmed: false }, { credentialID: '', creditID: 'b', confirmed: true }]) {
      expect(() => parseRedeemInput(input)).toThrow('INVALID_REQUEST');
    }
    expect(parseRedeemResult({ code: 'ok' })).toEqual({ code: 'ok', windowsReset: null });
    expect(parseRedeemResult({ code: 'ok', windows_reset: 2 })).toEqual({ code: 'ok', windowsReset: 2 });
    for (const input of [null, {}, { code: '<secret>' }, { code: 'ok', windows_reset: -1 }, { code: 'ok', windows_reset: 0.5 }]) {
      expect(() => parseRedeemResult(input)).toThrow('INVALID_RESPONSE');
    }
  });
});
