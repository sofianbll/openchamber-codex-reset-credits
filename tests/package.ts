// Check the delivery, not source fixtures; never access the real OpenCode home.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { parseManifestJson } from '@openchamber/sdk/schemas';

assert(process.argv[2], 'Usage: bun tests/package.ts /path/to/package');
const folder = resolve(process.argv[2]);
const expected = ['package.json', 'panel/index.html', 'panel/main.js', 'panel/style.css', 'service/main.js', 'logo.svg', 'README.md', 'LICENSE', 'CHANGELOG.md'].sort();
const entries = await readdir(folder, { recursive: true, withFileTypes: true });
assert(entries.every(entry => entry.isDirectory() || entry.isFile()), 'No symlinks or special files');
assert.deepEqual(entries.filter(entry => entry.isDirectory()).map(entry => join(entry.parentPath, entry.name).slice(folder.length + 1)).sort(), ['panel', 'service']);
const files = entries.filter(entry => entry.isFile()).map(entry => join(entry.parentPath, entry.name).slice(folder.length + 1)).sort();
assert.deepEqual(files, expected, 'Exact distribution allowlist');
const manifest = JSON.parse(await readFile(join(folder, 'package.json'), 'utf8'));
assert(parseManifestJson(JSON.stringify(manifest)).ok);
assert.deepEqual(Object.keys(manifest).sort(), ['name', 'version', 'private', 'type', 'license', 'openchamber'].sort());
for (const entry of [manifest.openchamber.contributes.panel.entry, manifest.openchamber.contributes.statusSection.entry, manifest.openchamber.contributes.service.entry]) assert(expected.includes(entry));
for (const file of files) {
  const text = await readFile(join(folder, file), 'utf8');
  assert(!/\/Users\/|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/.test(text), `Private path or credential in ${file}`);
  assert(!/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(text), `Email address in ${file}`);
}
for (const bundle of ['panel/main.js', 'service/main.js']) {
  assert((await readFile(join(folder, bundle))).length > 0);
  const check = Bun.spawn(['node', '--check', join(folder, bundle)], { stdout: 'inherit', stderr: 'inherit' });
  assert.equal(await check.exited, 0, `Invalid bundle: ${bundle}`);
}
const archive = await readFile(folder + '.tar.gz');
assert.equal(await readFile(folder + '.tar.gz.sha256', 'utf8'), `${createHash('sha256').update(archive).digest('hex')}  ${basename(folder)}.tar.gz\n`);
const tar = Bun.spawn(['tar', '-tzf', folder + '.tar.gz'], { stdout: 'pipe', stderr: 'inherit' });
const archived = (await new Response(tar.stdout).text()).trim().split('\n');
assert.equal(await tar.exited, 0);
assert.deepEqual(archived.filter(entry => !entry.endsWith('/')).sort(), expected.map(file => `${basename(folder)}/${file}`).sort());
const home = await mkdtemp(join(tmpdir(), 'codex-package-'));
const socket = createServer();
await new Promise<void>(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = (socket.address() as { port: number }).port;
await new Promise<void>(resolve => socket.close(() => resolve()));
const token = randomUUID(), origin = `http://127.0.0.1:${port}`;
const proc = Bun.spawn(['node', join(folder, 'service/main.js')], { cwd: folder, env: { PATH: process.env.PATH, HOME: home, XDG_DATA_HOME: join(home, 'data'), OPENCHAMBER_SERVICE_PORT: String(port), OPENCHAMBER_SERVICE_TOKEN: token }, stdout: 'ignore', stderr: 'pipe' });
try {
  let started = false;
  for (let i = 0; i < 100; i++) {
    try { assert.equal((await fetch(origin + '/health', { signal: AbortSignal.timeout(1000) })).status, 401); started = true; break; }
    catch { await Bun.sleep(25); }
  }
  assert(started, 'Service must start in an empty home');
  const request = (path: string) => fetch(origin + path, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
  assert.deepEqual(await (await request('/health')).json(), { ok: true });
  const accounts = await request('/accounts');
  assert.equal(accounts.status, 503);
  assert(['DATABASE_UNAVAILABLE', 'SQLITE_MISSING'].includes((await accounts.json()).error));
  assert.deepEqual(await (await request('/health')).json(), { ok: true });
  console.log('Package passed: exact allowlist, manifest, privacy, checksum, archive, syntax, isolated service/authentication and bounded missing-database error.');
} finally { proc.kill(); await proc.exited; await rm(home, { recursive: true, force: true }); }
