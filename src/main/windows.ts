/** Helpers for creating renderer windows that load either the Vite dev server or the built files. */
import { join } from 'node:path';
import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron';

export const PRELOAD = join(__dirname, '../preload/preload.cjs');

export function loadPage(win: BrowserWindow, page: 'index' | 'wallpaper', query: Record<string, string> = {}): Promise<void> {
  const devUrl = process.env.DESKFORGE_DEV_URL;
  if (devUrl) {
    const url = new URL(`${page}.html`, devUrl);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    return win.loadURL(url.toString());
  }
  return win.loadFile(join(__dirname, `../renderer/${page}.html`), { query });
}

export function createWallpaperWindow(extra: BrowserWindowConstructorOptions = {}): BrowserWindow {
  return new BrowserWindow({
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    backgroundColor: '#000000',
    // X11/macOS: render at desktop level. On Windows the window is re-parented to WorkerW instead.
    ...(process.platform !== 'win32' ? { type: 'desktop' } : {}),
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: false,
      spellcheck: false,
    },
    ...extra,
  });
}
