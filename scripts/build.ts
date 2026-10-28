export {};

await Bun.build({
  entrypoints: ['src/panel.ts'],
  outdir: 'panel',
  naming: 'main.js',
  target: 'browser',
  format: 'iife',
  minify: true,
}).then(check);

await Bun.build({
  entrypoints: ['src/service/main.ts'],
  outdir: 'service',
  naming: 'main.js',
  target: 'node',
  format: 'esm',
}).then(check);

function check(result: { success: boolean; logs: unknown[] }) {
  if (!result.success) throw new Error(result.logs.join('\n'));
}
