// Exercise the official host with an empty home; never read real credentials.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

assert(process.env.OPENCHAMBER_PACKAGE && process.argv[2], 'Set OPENCHAMBER_PACKAGE; run node tests/host-service.mjs /path/to/package');
const host = resolve(process.env.OPENCHAMBER_PACKAGE), folder = resolve(process.argv[2]);
const hostManifest = JSON.parse(await readFile(join(host, 'package.json'), 'utf8'));
assert.equal(hostManifest.name, '@openchamber/web');
const home = await mkdtemp(join(tmpdir(), 'codex-host-'));
process.env.HOME = home;
process.env.XDG_CONFIG_HOME = join(home, 'config');
process.env.XDG_DATA_HOME = join(home, 'data');
process.env.XDG_CACHE_HOME = join(home, 'cache');
let service;
try {
  const { inspectGuestPackage } = await import(pathToFileURL(join(host, 'server/lib/guests/catalog.js')).href);
  const result = await inspectGuestPackage(folder, { openchamberVersion: hostManifest.version });
  assert.equal(result.ok, true, JSON.stringify(result));
  const guest = result.guest;
  assert.equal(guest.service.runtime, 'host');
  service = await import(pathToFileURL(join(host, 'server/lib/guests/service.js')).href);
  service.beginGuestServiceHost({ registryDir: join(home, 'services') });
  const request = { guestId: guest.id, packageRoot: folder, service: guest.service, persistPath: join(home, 'settings.json'), method: 'GET', path: '/health', granted: ['service'] };
  await assert.rejects(service.proxyGuestServiceRequest({ ...request, granted: [] }), { code: 'NO_SERVICE' });
  assert.equal(service.getServiceStatus(guest.id), 'stopped');
  const health = await service.proxyGuestServiceRequest(request);
  assert.equal(health.status, 200);
  assert.deepEqual(JSON.parse(health.body), { ok: true });
  assert.equal(service.getServiceStatus(guest.id), 'ready');
  const accounts = await service.proxyGuestServiceRequest({ ...request, path: '/accounts' });
  assert.equal(accounts.status, 503);
  assert(['DATABASE_UNAVAILABLE', 'SQLITE_MISSING'].includes(JSON.parse(accounts.body).error));
  assert.equal((await service.proxyGuestServiceRequest(request)).status, 200);
  await service.setGuestEnabled(guest.id, request.persistPath, false);
  assert.equal(service.getServiceStatus(guest.id), 'stopped');
  await assert.rejects(service.proxyGuestServiceRequest(request), { code: 'DISABLED' });
  await service.setGuestEnabled(guest.id, request.persistPath, true);
  assert.equal((await service.proxyGuestServiceRequest(request)).status, 200);
  console.log(`Host service passed: OpenChamber ${hostManifest.version}; manifest, grants, proxy, bounded missing-database error, disable and restart.`);
} finally {
  if (service) { service.beginGuestServiceShutdown(); await service.stopAllGuestServices(); }
  await rm(home, { recursive: true, force: true });
}
