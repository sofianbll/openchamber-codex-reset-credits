import { afterEach, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { execFile, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { readAccounts } from '../src/service/accounts.ts';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function database() {
  const base = join(tmpdir(), 'opencode');
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(join(base, 'codex-reset-test-'));
  directories.push(directory);
  const path = join(directory, "synthetic-é-空-' ;process.exit(1);--.db");
  const db = new Database(path, { create: true });
  db.run('CREATE TABLE credential (id TEXT, label TEXT, active INTEGER, integration_id TEXT, value TEXT, time_created INTEGER);');
  db.close();
  return path;
}

function insert(path: string, id: string, integration: string, active: number | null, value: object, time: number) {
  const db = new Database(path);
  db.run('INSERT INTO credential VALUES (?, ?, ?, ?, ?, ?)', [id, `Label ${id}`, active, integration, JSON.stringify(value), time]);
  db.close();
}

const exec = promisify(execFile);
function readerWith(rewrite: (source: string) => string): NonNullable<Parameters<typeof readAccounts>[1]> {
  return (file, args, options) => {
    const source = rewrite(args[2]!);
    expect(source).not.toBe(args[2]);
    return exec(file, args.map((arg, index) => index === 2 ? source : arg), options);
  };
}

const missingNode = (source: string) => source.replace("import('node:sqlite')",
  "Promise.reject(Object.assign(new Error('synthetic-secret'), { code: 'ERR_UNKNOWN_BUILTIN_MODULE' }))");

async function sanitized(operation: Promise<unknown>, code = 'DATABASE_UNAVAILABLE') {
  const error = await operation.then(() => null, (error: unknown) => error);
  expect(error).toMatchObject({ message: code, code, status: 503 });
  expect(JSON.stringify(error)).not.toContain('synthetic-secret');
  expect(error instanceof Error && error.stack).not.toContain('synthetic-secret');
}

test('reads active and inactive OpenAI OAuth credentials without sqlite3 on PATH or changing the real SQLite fixture', async () => {
  const path = await database();
  insert(path, 'inactive', 'openai', 0, { type: 'oauth', access: 'synthetic-inactive-access', refresh: 'synthetic-refresh-never-return', metadata: { accountID: 'chatgpt-inactive' } }, 2);
  insert(path, 'active', 'openai', 1, { type: 'oauth', access: 'synthetic-active-access', metadata: { accountID: 'chatgpt-active' } }, 1);
  insert(path, 'api-key', 'openai', 1, { type: 'key', key: 'synthetic-key' }, 0);
  insert(path, 'mcp', 'mcp', 1, { type: 'oauth', access: 'irrelevant' }, 0);
  const before = await readFile(path);
  const previousPath = process.env.PATH;
  let accounts;
  try {
    process.env.PATH = join(path, 'no-external-commands');
    accounts = await readAccounts(path);
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
  }
  expect(accounts).toEqual([
    { id: 'active', label: 'Label active', active: true, access: 'synthetic-active-access', accountID: 'chatgpt-active' },
    { id: 'inactive', label: 'Label inactive', active: false, access: 'synthetic-inactive-access', accountID: 'chatgpt-inactive' },
  ]);
  expect(JSON.stringify(accounts)).not.toContain('synthetic-refresh-never-return');
  expect(await readFile(path)).toEqual(before);
});

test('credentials without an active flag are read as inactive', async () => {
  const path = await database();
  // A credential imported from a legacy auth.json keeps `active` unset instead of 0 or 1.
  insert(path, 'legacy', 'openai', null, { type: 'oauth', access: 'synthetic-legacy' }, 1);
  expect(await readAccounts(path)).toEqual([
    { id: 'legacy', label: 'Label legacy', active: false, access: 'synthetic-legacy', accountID: null },
  ]);
});

test('invalid credentials and database failures are sanitized', async () => {
  const path = await database();
  insert(path, 'bad', 'openai', 1, { type: 'oauth', access: 123, refresh: 'synthetic-secret' }, 1);
  await expect(readAccounts(path)).rejects.toMatchObject({ code: 'DATABASE_SCHEMA', status: 503 });
  await expect(readAccounts(join(path, 'synthetic-secret'))).rejects.toMatchObject({ message: 'DATABASE_UNAVAILABLE', status: 503 });
});

test('empty accounts, optional account IDs and equal-time ID order are preserved', async () => {
  const path = await database();
  expect(await readAccounts(path)).toEqual([]);
  insert(path, 'b', 'openai', 0, { type: 'oauth', access: 'synthetic-b' }, 1);
  insert(path, 'a', 'openai', 1, { type: 'oauth', access: 'synthetic-a' }, 1);
  expect(await readAccounts(path)).toEqual([
    { id: 'a', label: 'Label a', active: true, access: 'synthetic-a', accountID: null },
    { id: 'b', label: 'Label b', active: false, access: 'synthetic-b', accountID: null },
  ]);
});

test('reads the latest committed WAL rows during a writer transaction without changing database or WAL', async () => {
  const path = await database();
  const beforeWal = await readFile(path);
  const writer = new Database(path);
  try {
    writer.exec('PRAGMA journal_mode = WAL; PRAGMA wal_autocheckpoint = 0;');
    const main = await readFile(path);
    writer.run('INSERT INTO credential VALUES (?, ?, ?, ?, ?, ?)',
      ['wal', 'Label wal', 1, 'openai', JSON.stringify({ type: 'oauth', access: 'synthetic-wal' }), 1]);
    // The committed row is in WAL, not a snapshot of the main file.
    expect(await readFile(path)).toEqual(main);
    expect(main).not.toEqual(beforeWal);
    writer.exec("BEGIN IMMEDIATE; UPDATE credential SET label = 'Uncommitted';");
    const wal = await readFile(`${path}-wal`);
    expect(await readAccounts(path)).toEqual([
      { id: 'wal', label: 'Label wal', active: true, access: 'synthetic-wal', accountID: null },
    ]);
    expect(await readFile(path)).toEqual(main);
    expect(await readFile(`${path}-wal`)).toEqual(wal);
  } finally {
    if (writer.inTransaction) writer.exec('ROLLBACK;');
    writer.close();
  }
});

test.each([false, true])('read-only mode prevents writes and never creates missing files (Bun fallback: %s)', async (fallback) => {
  const path = await database();
  insert(path, 'safe', 'openai', 1, { type: 'oauth', access: 'synthetic-safe' }, 1);
  const before = await readFile(path);
  const runtime = fallback ? missingNode : (source: string) => source;
  await sanitized(readAccounts(path, readerWith((source) => runtime(source).replace(
    'let rows;', 'db.exec("DELETE FROM credential"); let rows;',
  ))));
  expect(await readFile(path)).toEqual(before);
  const absent = `${path}-synthetic-secret-missing`;
  await sanitized(readAccounts(absent, readerWith(runtime)));
  for (const suffix of ['', '-wal', '-shm']) expect(existsSync(absent + suffix)).toBe(false);
});

test.each([
  'UPDATE credential SET id = NULL',
  'UPDATE credential SET label = NULL',
  'UPDATE credential SET active = 2',
  `UPDATE credential SET value = '{"type":"oauth","access":123}'`,
  `UPDATE credential SET value = '{"type":"oauth","access":""}'`,
  `UPDATE credential SET value = '{"type":"oauth"}'`,
  `UPDATE credential SET value = '{"type":"oauth","access":"synthetic-secret","metadata":{"accountID":123}}'`,
])('rejects malformed credential fields: %s', async (sql) => {
  const path = await database();
  insert(path, 'bad', 'openai', 1, { type: 'oauth', access: 'synthetic-secret' }, 1);
  const db = new Database(path);
  db.exec(sql);
  db.close();
  await sanitized(readAccounts(path), 'DATABASE_SCHEMA');
});

test.each(['malformed JSON', 'missing schema', 'corrupt database'])('%s produces only a sanitized database error', async (kind) => {
  const path = await database();
  insert(path, 'bad', 'openai', 1, { type: 'oauth', access: 'synthetic-secret' }, 1);
  if (kind === 'corrupt database') {
    await writeFile(path, 'synthetic-secret-not-a-database');
  } else {
    const db = new Database(path);
    db.exec(kind === 'missing schema' ? 'DROP TABLE credential;' : `UPDATE credential SET value = 'synthetic-secret-not-json'`);
    db.close();
  }
  await sanitized(readAccounts(path));
});

test('uses node:sqlite first and falls back to bun:sqlite only when the module is missing', async () => {
  const path = await database();
  insert(path, 'fallback', 'openai', 0, { type: 'oauth', access: 'synthetic-fallback' }, 1);
  const forbidBun = (source: string) => source.replace("import('bun:sqlite')",
    'Promise.resolve({ Database: class { prepare() { return { iterate: () => [] }; } close() {} } })');
  const accounts = await readAccounts(path, readerWith(forbidBun));
  expect(await readAccounts(path, readerWith(missingNode))).toEqual(accounts);
  await sanitized(readAccounts(path, readerWith((source) => forbidBun(source).replace(
    "import('node:sqlite')", "Promise.reject(new Error('synthetic-secret-import-error'))",
  ))));
  await sanitized(readAccounts(`${path}-missing`, readerWith(forbidBun)));
});

test('missing built-ins fail explicitly without requiring an external executable', async () => {
  const path = await database();
  await sanitized(readAccounts(path, readerWith((source) => missingNode(source).replace(
    'if (!process.versions.bun)', 'if (true)',
  ))), 'SQLITE_UNAVAILABLE');
  await sanitized(readAccounts(path, readerWith((source) => missingNode(source).replace(
    "import('bun:sqlite')", "Promise.reject(Object.assign(new Error('synthetic-secret'), { code: 'ERR_MODULE_NOT_FOUND' }))",
  ))), 'SQLITE_UNAVAILABLE');
  await sanitized(readAccounts(path, readerWith((source) => source.replace(
    "import('node:sqlite')", 'Promise.resolve({ DatabaseSync: class {}, StatementSync: class {} })',
  ))), 'SQLITE_UNAVAILABLE');
});

test('the 2 MiB return limit counts UTF-8 bytes across rows without forwarding partial results', async () => {
  const path = await database();
  insert(path, 'large-a', 'openai', 1, { type: 'oauth', access: '界'.repeat(360_000) }, 1);
  insert(path, 'large-b', 'openai', 0, { type: 'oauth', access: '界'.repeat(360_000) }, 2);
  await sanitized(readAccounts(path));
});

test.each([
  "throw new Error('synthetic-secret-runtime-error');",
  'process.exit(0);',
  "process.stdout.write('synthetic-secret-invalid-json');",
])('child runtime failures cannot escape as raw errors: %s', async (source) => {
  await sanitized(readAccounts('synthetic-secret-path', readerWith(() => source)));
});

test('native SQLite work is killed after five seconds while the service event loop remains responsive', async () => {
  let child: ChildProcess | undefined;
  const stuck: NonNullable<Parameters<typeof readAccounts>[1]> = (file, args, options) => {
    const operation = exec(file, args.map((arg, index) => index === 2 ? `
      const { DatabaseSync } = require('node:sqlite');
      new DatabaseSync(':memory:').prepare(
        'WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<1000000000) SELECT sum(x) FROM n'
      ).get();
    ` : arg), options);
    child = operation.child;
    return operation;
  };
  const started = performance.now();
  const reading = readAccounts('synthetic-secret-path', stuck);
  expect(await Promise.race([
    reading.then(() => 'read', () => 'read'),
    new Promise((resolve) => setTimeout(() => resolve('responsive'), 30)),
  ])).toBe('responsive');
  await sanitized(reading);
  expect(performance.now() - started).toBeGreaterThanOrEqual(4900);
  expect(performance.now() - started).toBeLessThan(10000);
  expect(child!.exitCode !== null || child!.signalCode !== null).toBe(true);
  if (process.platform !== 'win32') {
    expect(child?.signalCode).toBe('SIGKILL');
    expect(() => process.kill(child!.pid!, 0)).toThrow();
  }
}, 12000);
