import { execFile, type ExecFileOptionsWithStringEncoding } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Failure, isRecord } from '../contracts.ts';

export type Account = { id: string; label: string; active: boolean; access: string; accountID: string | null };

const exec = promisify(execFile);
type Execute = (file: string, args: string[], options: ExecFileOptionsWithStringEncoding) => Promise<{ stdout: string }>;
export const defaultDatabase = join(homedir(), '.local', 'share', 'opencode', 'opencode.db');

// Do not select the value blob: it also contains refresh tokens we do not need.
// `active` is nullable: credentials imported from a legacy auth.json keep it unset, which OpenCode reads as inactive.
const query = `SELECT id, label, COALESCE(active, 0) AS active,
  json_extract(value, '$.access') AS access,
  json_extract(value, '$.metadata.accountID') AS accountID
  FROM credential
  WHERE integration_id = 'openai' AND json_extract(value, '$.type') = 'oauth'
  ORDER BY time_created, id;`;

// A killable host-runtime child bounds native SQLite work; inline JS survives the single-file bundle.
const sqliteReader = `
(async () => {
  let code = 'DATABASE_UNAVAILABLE';
  try {
    let sqlite, bun = false;
    const missing = (error) => ['ERR_UNKNOWN_BUILTIN_MODULE', 'ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'].includes(error?.code);
    try {
      sqlite = await import('node:sqlite');
    } catch (error) {
      if (!missing(error)) throw error;
      code = 'SQLITE_UNAVAILABLE';
      if (!process.versions.bun) throw error;
      try {
        sqlite = await import('bun:sqlite');
        bun = true;
      } catch (error) {
        if (!missing(error)) code = 'DATABASE_UNAVAILABLE';
        throw error;
      }
    }
    code = 'SQLITE_UNAVAILABLE';
    if (typeof (bun ? sqlite.Database : sqlite.DatabaseSync) !== 'function' ||
        (!bun && typeof sqlite.StatementSync?.prototype?.iterate !== 'function')) throw new Error();
    code = 'DATABASE_UNAVAILABLE';
    const db = bun
      ? new sqlite.Database(process.argv[1], { readonly: true, create: false })
      : new sqlite.DatabaseSync(process.argv[1], { readOnly: true });
    let rows;
    try {
      const result = [];
      let size = 2;
      for (const row of db.prepare(${JSON.stringify(query)}).iterate()) {
        const json = JSON.stringify(row);
        size += Buffer.byteLength(json) + (result.length ? 1 : 0);
        if (size > 2 * 1024 * 1024) throw new Error();
        result.push(json);
      }
      rows = '[' + result.join(',') + ']';
    } finally {
      db.close();
    }
    process.stdout.write(rows);
  } catch {
    process.stdout.write(code);
  }
})();
`;

export async function readAccounts(database = defaultDatabase, execute: Execute = exec): Promise<Account[]> {
  let rows: unknown;
  try {
    const { stdout } = await execute(process.execPath, ['--input-type=commonjs', '-e', sqliteReader, '--', database], {
      encoding: 'utf8', timeout: 5000, maxBuffer: 2 * 1024 * 1024, killSignal: 'SIGKILL', windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    });
    if (stdout === 'SQLITE_UNAVAILABLE') throw new Failure('SQLITE_UNAVAILABLE', 503);
    if (Buffer.byteLength(stdout) > 2 * 1024 * 1024) throw new Error();
    rows = JSON.parse(stdout);
  } catch (error) {
    // Child-process errors can contain stdout, including access tokens.
    throw new Failure(error instanceof Failure && error.code === 'SQLITE_UNAVAILABLE' ? 'SQLITE_UNAVAILABLE' : 'DATABASE_UNAVAILABLE', 503);
  }
  if (!Array.isArray(rows)) throw new Failure('DATABASE_SCHEMA', 503);
  return rows.map((row: unknown) => {
    if (!isRecord(row) || typeof row.id !== 'string' || typeof row.label !== 'string' ||
        typeof row.access !== 'string' || !row.access || (row.active !== 0 && row.active !== 1) ||
        (row.accountID !== null && typeof row.accountID !== 'string')) throw new Failure('DATABASE_SCHEMA', 503);
    return { id: row.id, label: row.label, active: row.active === 1, access: row.access, accountID: row.accountID };
  });
}
