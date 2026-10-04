import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { IPC, controlsFromSettings, type Settings } from '../shared/ipc';
import { PACKAGE_EXT } from '../shared/sharing/package';
import { describeActive, registerIpc } from './ipc';
import { createPlatform } from './platform';
import { handleThemeProtocol, registerSchemePrivileges } from './protocol';
import { SettingsStore } from './settings';
import { ThemeStore } from './storage';
import { TrayController, resourcePath } from './tray';
import { WallpaperHost } from './wallpaperHost';
import { loadPage, PRELOAD } from './windows';

app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

registerSchemePrivileges();

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function packageFromArgv(argv: string[]): string | null {
  return argv.find((arg) => arg.toLowerCase().endsWith(`.${PACKAGE_EXT}`) && existsSync(arg)) ?? null;
}

let studio: BrowserWindow | null = null;
let tray: TrayController | null = null;
let quitting = false;
let restoring = false;

const userData = app.getPath('userData');
const settings = new SettingsStore(userData);
const store = new ThemeStore(join(userData, 'themes'));
const platform = createPlatform(userData);
let host: WallpaperHost;

function createStudio(show: boolean): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false,
    title: 'DeskForge',
    icon: appIconPath(),
    backgroundColor: '#0f1117',
    autoHideMenuBar: true,
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true },
  });
  win.once('ready-to-show', () => {
    if (show) win.show();
  });
  win.on('close', (e) => {
    if (!quitting && host.status().running) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => {
    studio = null;
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
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

function appIconPath(): string {
  return resourcePath('icon.png');
}

function refreshTray() {
  tray?.refresh(describeActive(host.activeTheme));
}

function broadcast(channel: string, payload?: unknown) {
  for (const win of [studio, tray?.flyoutWindow ?? null]) {
    if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function onSettingsChanged(next: Settings) {
  applySettingsSideEffects(next);
  host.setControls(controlsFromSettings(next));
  broadcast(IPC.settingsChanged, next);
  refreshTray();
}

function stopWallpaper() {
  host.stop();
  void settings.set({ activeThemeId: null });
}

function quitApp() {
  quitting = true;
  app.quit();
}

function applySettingsSideEffects(s: Settings) {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    const portable = process.env.PORTABLE_EXECUTABLE_FILE;
    app.setLoginItemSettings({ openAtLogin: s.launchAtStartup, args: ['--hidden'], ...(portable ? { path: portable } : {}) });
  }
}

async function importFromFile(path: string) {
  try {
    const theme = await store.importPackage(path);
    showStudio();
    const target = studio!;
    const send = () => {
      target.webContents.send(IPC.libraryChanged);
      target.webContents.send(IPC.themesImported, { id: theme.id, name: theme.name });
    };
    if (target.webContents.isLoading()) target.webContents.once('did-finish-load', send);
    else send();
    return theme;
  } catch (err) {
    console.warn('Could not import', path, err);
    throw err;
  }
}

app.on('second-instance', (_event, argv) => {
  const pkg = packageFromArgv(argv);
  if (pkg && host) void importFromFile(pkg).catch(() => showStudio());
  else showStudio();
});

app.whenReady().then(async () => {
  await store.init();
  const s = await settings.load();
  handleThemeProtocol(store);
  await settings.set({ launchCount: s.launchCount + 1 });
  host = new WallpaperHost(platform);
  host.setControls(controlsFromSettings(s));
  host.onStatus((status) => {
    refreshTray();
    broadcast(IPC.desktopStatusChanged, status);
  });

  registerIpc({
    store,
    settings,
    platform,
    host,
    importPackage: importFromFile,
    studioWindow: () => studio,
    applySettingsSideEffects,
    broadcast,
  });

  tray = new TrayController(host, settings, { showStudio, quit: quitApp, stopWallpaper });
  tray.onSettingsChangedFromTray(onSettingsChanged);
  tray.create();
  refreshTray();

  ipcMain.on(IPC.appShowStudio, () => {
    tray?.hideFlyout();
    showStudio();
  });
  ipcMain.on(IPC.appHideFlyout, () => tray?.hideFlyout());
  ipcMain.on(IPC.appQuit, quitApp);

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
  applySettingsSideEffects(s);

  const pkg = packageFromArgv(process.argv);
  if (pkg) void importFromFile(pkg).catch(() => undefined);
});

app.on('window-all-closed', () => {
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
  tray?.destroy();
});
