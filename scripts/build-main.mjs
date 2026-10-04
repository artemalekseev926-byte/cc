// Bundles the Electron main process and preload script with esbuild.
// Native modules (koffi, steamworks.js) stay external and are loaded at runtime.
import { build } from 'esbuild';

const watch = process.argv.includes('--watch');

const common = {
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['electron', 'koffi', 'steamworks.js'],
  logLevel: 'info',
};

const configs = [
  { ...common, entryPoints: ['src/main/main.ts'], outfile: 'dist/main/main.cjs' },
  { ...common, entryPoints: ['src/preload/preload.ts'], outfile: 'dist/preload/preload.cjs' },
];

if (watch) {
  const { context } = await import('esbuild');
  for (const cfg of configs) {
    const ctx = await context(cfg);
    await ctx.watch();
  }
} else {
  await Promise.all(configs.map((cfg) => build(cfg)));
}
