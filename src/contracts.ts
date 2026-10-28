export type RedemptionState = 'pending' | 'requested' | 'unknown';

export type Credit = {
  id: string;
  reset_type: string;
  status: string;
  title: string | null;
  description: string | null;
  granted_at: string | null;
  expires_at: string | null;
  redemption?: RedemptionState;
};

export type AccountSnapshot = {
  id: string;
  label: string;
  active: boolean;
  credits: Credit[] | null;
  availableCount: number | null;
  error: string | null;
};

export type Snapshot = { fetchedAt: string; accounts: AccountSnapshot[] };
export type RedeemInput = { credentialID: string; creditID: string; confirmed: true };
export type RedeemResult = { code: string; windowsReset: number | null };

export class Failure extends Error {
  constructor(public code: string, public status = 502) {
    super(code);
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const nullableText = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || value.length > 10_000) throw new Failure('INVALID_RESPONSE');
  return value;
};

const date = (value: unknown): string | null => {
  const text = nullableText(value);
  if (text !== null && !Number.isFinite(Date.parse(text))) throw new Failure('INVALID_RESPONSE');
  return text;
};

export function parseCredits(payload: unknown): { credits: Credit[]; availableCount: number } {
  if (!isRecord(payload) || !Array.isArray(payload.credits) || payload.credits.length > 1000 ||
      !Number.isSafeInteger(payload.available_count) || Number(payload.available_count) < 0) {
    throw new Failure('INVALID_RESPONSE');
  }
  const seen = new Set<string>();
  const credits = payload.credits.map((credit: unknown): Credit => {
    if (!isRecord(credit) || typeof credit.id !== 'string' || !credit.id || credit.id.length > 500 ||
        typeof credit.status !== 'string' || !credit.status || typeof credit.reset_type !== 'string' || !credit.reset_type ||
        seen.has(credit.id)) throw new Failure('INVALID_RESPONSE');
    seen.add(credit.id);
    return {
      id: credit.id, status: credit.status, reset_type: credit.reset_type,
      title: nullableText(credit.title), description: nullableText(credit.description),
      granted_at: date(credit.granted_at), expires_at: date(credit.expires_at),
    };
  });
  return { credits, availableCount: Number(payload.available_count) };
}

export function canRedeem(credit: Credit, now = Date.now()): boolean {
  return credit.status === 'available' && !credit.redemption &&
    (credit.expires_at === null || Date.parse(credit.expires_at) > now);
}

export function parseRedeemInput(input: unknown): RedeemInput {
  if (!isRecord(input) || input.confirmed !== true ||
      typeof input.credentialID !== 'string' || !input.credentialID || input.credentialID.length > 500 ||
      typeof input.creditID !== 'string' || !input.creditID || input.creditID.length > 500) {
    throw new Failure('INVALID_REQUEST', 400);
  }
  return { credentialID: input.credentialID, creditID: input.creditID, confirmed: true };
}

export function parseRedeemResult(input: unknown): RedeemResult {
  if (!isRecord(input) || typeof input.code !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(input.code) ||
      (input.windows_reset !== undefined && (!Number.isSafeInteger(input.windows_reset) || Number(input.windows_reset) < 0))) {
    throw new Failure('INVALID_RESPONSE');
  }
  return { code: input.code, windowsReset: input.windows_reset === undefined ? null : Number(input.windows_reset) };
}
