// Build only the files needed by OpenChamber's folder installer.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { parseManifestJson } from '@openchamber/sdk/schemas';

const output = process.argv[2];
assert(output && isAbsolute(output), 'Usage: bun package.ts /absolute/path/to/a-new-folder');
process.chdir(import.meta.dir);
for (const path of [output, output + '.tar.gz', output + '.tar.gz.sha256']) {
  assert.equal(await lstat(path).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; }), false, `Output already exists: ${path}`);
}
await import('./scripts/build.ts');
const source = await Bun.file('package.json').json();
const manifest = { name: source.name, version: source.version, private: true, type: 'module', license: source.license, openchamber: source.openchamber };
assert(parseManifestJson(JSON.stringify(manifest)).ok, 'Invalid distribution manifest');
await mkdir(output);
await writeFile(join(output, 'package.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
for (const file of ['panel/index.html', 'panel/main.js', 'panel/style.css', 'service/main.js', 'logo.svg', 'README.md', 'LICENSE', 'CHANGELOG.md']) {
  assert((await lstat(file)).isFile(), `Expected regular file: ${file}`);
  await mkdir(dirname(join(output, file)), { recursive: true });
  await copyFile(file, join(output, file));
}
const tar = Bun.spawn(['tar', '-czf', '-', '-C', dirname(output), basename(output)], { env: { ...process.env, COPYFILE_DISABLE: '1' }, stdout: 'pipe', stderr: 'inherit' });
const archive = Buffer.from(await new Response(tar.stdout).arrayBuffer());
assert.equal(await tar.exited, 0, 'Archive creation failed');
await writeFile(output + '.tar.gz', archive, { flag: 'wx' });
await writeFile(output + '.tar.gz.sha256', `${createHash('sha256').update(archive).digest('hex')}  ${basename(output)}.tar.gz\n`, { flag: 'wx' });
console.log(`Installable folder: ${output}\nArchive: ${output}.tar.gz (${archive.length} bytes)`);
