import { afterEach, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  const path = join(directory, 'synthetic.db');
  execFileSync('sqlite3', [path, 'CREATE TABLE credential (id TEXT, label TEXT, active INTEGER, integration_id TEXT, value TEXT, time_created INTEGER);']);
  return path;
}

function insert(path: string, id: string, integration: string, active: number, value: object, time: number) {
  const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
  execFileSync('sqlite3', [path, `INSERT INTO credential VALUES (${quote(id)}, ${quote(`Label ${id}`)}, ${active}, ${quote(integration)}, ${quote(JSON.stringify(value))}, ${time});`]);
}

test('reads active and inactive OpenAI OAuth credentials without changing the real SQLite fixture', async () => {
  const path = await database();
  insert(path, 'inactive', 'openai', 0, { type: 'oauth', access: 'synthetic-inactive-access', refresh: 'synthetic-refresh-never-return', metadata: { accountID: 'chatgpt-inactive' } }, 2);
  insert(path, 'active', 'openai', 1, { type: 'oauth', access: 'synthetic-active-access', metadata: { accountID: 'chatgpt-active' } }, 1);
  insert(path, 'api-key', 'openai', 1, { type: 'key', key: 'synthetic-key' }, 0);
  insert(path, 'mcp', 'mcp', 1, { type: 'oauth', access: 'irrelevant' }, 0);
  const before = await readFile(path);
  const accounts = await readAccounts(path);
  expect(accounts).toEqual([
    { id: 'active', label: 'Label active', active: true, access: 'synthetic-active-access', accountID: 'chatgpt-active' },
    { id: 'inactive', label: 'Label inactive', active: false, access: 'synthetic-inactive-access', accountID: 'chatgpt-inactive' },
  ]);
  expect(JSON.stringify(accounts)).not.toContain('synthetic-refresh-never-return');
  expect(await readFile(path)).toEqual(before);
});

test('invalid credentials and database failures are sanitized', async () => {
  const path = await database();
  insert(path, 'bad', 'openai', 1, { type: 'oauth', access: 123, refresh: 'synthetic-secret' }, 1);
  await expect(readAccounts(path)).rejects.toMatchObject({ code: 'DATABASE_SCHEMA', status: 503 });
  await expect(readAccounts(join(path, 'synthetic-secret'))).rejects.toMatchObject({ message: 'DATABASE_UNAVAILABLE', status: 503 });
});
