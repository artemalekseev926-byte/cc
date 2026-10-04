/**
 * DeskForge main process: studio window, tray, live wallpaper host, Steam.
 *
 * The app keeps running in the tray while a live wallpaper is active; closing
 * the studio window only hides it.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, BrowserWindow, Menu, nativeImage, shell, Tray } from 'electron';
import type { Settings } from '../shared/ipc';
import { describeActive, registerIpc } from './ipc';
import { createPlatform } from './platform';
import { handleThemeProtocol, registerSchemePrivileges } from './protocol';
import { SettingsStore } from './settings';
import { SteamService } from './steam';
import { ThemeStore } from './storage';
import { WallpaperHost } from './wallpaperHost';
import { loadPage, PRELOAD } from './windows';

// The performance probe renders in a transparent window; make sure Chromium does not
// throttle it (or the wallpaper surfaces) as "occluded" or "backgrounded".
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
// Wallpapers should never play sound and never need a user gesture to start video.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

registerSchemePrivileges();

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function readSteamAppId(): number {
  const fromEnv = Number(process.env.DESKFORGE_STEAM_APP_ID);
  if (fromEnv > 0) return fromEnv;
  try {
    const pkg = JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf8'));
    return Number(pkg.deskforge?.steamAppId) || 480;
  } catch {
    return 480; // Spacewar — Valve's public test app id
  }
}

let studio: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let restoring = false;

const userData = app.getPath('userData');
const settings = new SettingsStore(userData);
const store = new ThemeStore(join(userData, 'themes'));
const platform = createPlatform(userData);
const steam = new SteamService(readSteamAppId());
let host: WallpaperHost;

function createStudio(show: boolean): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'DeskForge',
    backgroundColor: '#0f1117',
    autoHideMenuBar: true,
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true },
  });
  win.once('ready-to-show', () => {
    if (show) win.show();
  });
  win.on('close', (e) => {
    // Keep running in the tray while a wallpaper is live.
    if (!quitting && host.status().running) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => {
    studio = null;
  });
  // Links in descriptions open in the real browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^steam:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:') && !url.startsWith(process.env.DESKFORGE_DEV_URL ?? '\0')) e.preventDefault();
  });
  void loadPage(win, 'index');
  return win;
}

function showStudio() {
  if (!studio) studio = createStudio(true);
  else {
    if (studio.isMinimized()) studio.restore();
    studio.show();
    studio.focus();
  }
}

function trayIcon() {
  // 16x16 accent-colored square drawn in code so the build has no binary dependency.
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) buf.set([0xff, 0x5c, 0x6c, 0xff], i * 4); // BGRA
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

function refreshTray() {
  if (!tray) return;
  const status = host.status();
  tray.setToolTip(describeActive(host.activeTheme));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open DeskForge', click: showStudio },
      { type: 'separator' },
      {
        label: status.pauseReason === 'manual' ? 'Resume wallpaper' : 'Pause wallpaper',
        enabled: status.running,
        click: () => host.setManualPause(status.pauseReason !== 'manual'),
      },
      { label: 'Stop wallpaper', enabled: status.running, click: () => { host.stop(); void settings.set({ activeThemeId: null }); } },
      { type: 'separator' },
      { label: 'Quit', click: () => { quitting = true; app.quit(); } },
    ]),
  );
}

function applySettingsSideEffects(s: Settings) {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    app.setLoginItemSettings({ openAtLogin: s.launchAtStartup, args: ['--hidden'] });
  }
}

app.on('second-instance', showStudio);

app.whenReady().then(async () => {
  await store.init();
  const s = await settings.load();
  handleThemeProtocol(store);
  steam.init();
  store.setWorkshopItems(steam.installedItems());
  host = new WallpaperHost(platform);
  host.onStatus(refreshTray);

  registerIpc({ store, settings, platform, host, steam, studioWindow: () => studio, applySettingsSideEffects });

  tray = new Tray(trayIcon());
  tray.on('click', showStudio);
  refreshTray();

  // Resume the last applied theme (wallpaper only — system settings persist on their own).
  if (s.activeThemeId) {
    try {
      await host.show(await store.load(s.activeThemeId));
    } catch (err) {
      console.warn('Could not resume theme', s.activeThemeId, err);
      await settings.set({ activeThemeId: null });
    }
  }

  const startHidden = process.argv.includes('--hidden') && host.status().running;
  studio = createStudio(!startHidden);
});

app.on('window-all-closed', () => {
  // Stay alive in the tray if a wallpaper is running.
  if (!host?.status().running) app.quit();
});

app.on('before-quit', async (e) => {
  quitting = true;
  if (settings.get().restoreOnExit && !restoring) {
    e.preventDefault();
    restoring = true;
    host?.stop();
    await platform.restoreOriginal().catch(() => undefined);
    platform.dispose();
    app.quit();
    return;
  }
  host?.stop();
  platform.dispose();
});
