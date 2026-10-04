import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

const stripCspInDev: Plugin = {
  name: 'strip-csp-in-dev',
  apply: 'serve',
  transformIndexHtml: (html) => html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, ''),
};

export default defineConfig({
  root: resolve(root, 'src/renderer'),
  base: './',
  plugins: [react(), stripCspInDev],
  server: { host: '127.0.0.1', port: 5183, strictPort: true },
  build: {
    outDir: resolve(root, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(root, 'src/renderer/index.html'),
        wallpaper: resolve(root, 'src/renderer/wallpaper.html'),
      },
    },
  },
});
