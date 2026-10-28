import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Failure, isRecord } from '../contracts.ts';

export type Account = { id: string; label: string; active: boolean; access: string; accountID: string | null };

const exec = promisify(execFile);
export const defaultDatabase = join(homedir(), '.local', 'share', 'opencode', 'opencode.db');

// Do not select the value blob: it also contains refresh tokens we do not need.
const query = `SELECT id, label, active,
  json_extract(value, '$.access') AS access,
  json_extract(value, '$.metadata.accountID') AS accountID
  FROM credential
  WHERE integration_id = 'openai' AND json_extract(value, '$.type') = 'oauth'
  ORDER BY time_created, id;`;

export async function readAccounts(database = defaultDatabase): Promise<Account[]> {
  let rows: unknown;
  try {
    const { stdout } = await exec('sqlite3', ['-readonly', '-json', database, query], {
      timeout: 5000, maxBuffer: 2 * 1024 * 1024,
    });
    rows = stdout.trim() ? JSON.parse(stdout) : [];
  } catch (error) {
    // Child-process errors can contain stdout, including access tokens.
    throw new Failure(isRecord(error) && error.code === 'ENOENT' ? 'SQLITE_MISSING' : 'DATABASE_UNAVAILABLE', 503);
  }
  if (!Array.isArray(rows)) throw new Failure('DATABASE_SCHEMA', 503);
  return rows.map((row: unknown) => {
    if (!isRecord(row) || typeof row.id !== 'string' || typeof row.label !== 'string' ||
        typeof row.access !== 'string' || !row.access || (row.active !== 0 && row.active !== 1) ||
        (row.accountID !== null && typeof row.accountID !== 'string')) throw new Failure('DATABASE_SCHEMA', 503);
    return { id: row.id, label: row.label, active: row.active === 1, access: row.access, accountID: row.accountID };
  });
}
