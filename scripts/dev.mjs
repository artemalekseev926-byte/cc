import { spawn } from 'node:child_process';
import { createServer } from 'vite';

const server = await createServer({ configFile: 'vite.config.ts' });
await server.listen();
const url = 'http://127.0.0.1:5183/';

const esbuild = spawn(process.execPath, ['scripts/build-main.mjs', '--watch'], { stdio: 'inherit' });
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
