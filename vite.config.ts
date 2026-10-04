import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

// React Fast Refresh injects an inline script in dev; the strict CSP only applies to builds.
const stripCspInDev: Plugin = {
  name: 'strip-csp-in-dev',
  apply: 'serve',
  transformIndexHtml: (html) => html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, ''),
};

// The renderer has two entry pages:
//  - index.html      — the studio (library, editor, workshop, performance)
//  - wallpaper.html  — the live wallpaper host that sits behind desktop icons
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [react(), stripCspInDev],
  server: { port: 5183, strictPort: true },
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/renderer/index.html'),
        wallpaper: resolve(__dirname, 'src/renderer/wallpaper.html'),
      },
    },
  },
});
