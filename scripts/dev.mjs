// Development runner: Vite dev server for the renderer + esbuild watch for main/preload,
// then launches Electron pointed at the dev server.
import { spawn } from 'node:child_process';
import { createServer } from 'vite';

const server = await createServer({ configFile: 'vite.config.ts' });
await server.listen();
const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost:5183/';

const esbuild = spawn(process.execPath, ['scripts/build-main.mjs', '--watch'], { stdio: 'inherit' });
// Give esbuild a moment to produce the first bundle.
await new Promise((r) => setTimeout(r, 1500));

const electronBin = (await import('electron')).default;
const app = spawn(electronBin, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, DESKFORGE_DEV_URL: url },
});
app.on('exit', () => {
  esbuild.kill();
  server.close();
  process.exit(0);
});
