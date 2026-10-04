import { join } from 'node:path';
import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron';
import { IPC, controlsFromSettings, themeFileUrl, type Settings } from '../shared/ipc';
import { isValidTweakValue, type TweakId } from '../shared/system/tweaks';
import { appsStatus, installApp, uninstallApp } from './apps';
import { estimateTheme } from '../shared/perf/estimator';
import { parseTheme, type Theme } from '../shared/theme/schema';
import { AUDIO_EXTENSIONS, IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from '../shared/sharing/import';
import { PACKAGE_EXT, packageFileName } from '../shared/sharing/package';
import { probeTheme } from './perfProbe';
import type { PlatformAdapter } from './platform';
import type { SettingsStore } from './settings';
import type { ThemeStore } from './storage';
import type { WallpaperHost } from './wallpaperHost';

export interface Services {
  store: ThemeStore;
  settings: SettingsStore;
  platform: PlatformAdapter;
  host: WallpaperHost;
  importPackage: (path: string) => Promise<unknown>;
  broadcast: (channel: string, payload?: unknown) => void;
  studioWindow: () => BrowserWindow | null;
  applySettingsSideEffects: (s: Settings) => void;
}

function requireTheme(input: unknown): Theme {
  const parsed = parseTheme(input);
  if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
  return parsed.theme;
}

function primaryDisplayInfo() {
  const d = screen.getPrimaryDisplay();
  return {
    width: Math.round(d.size.width * d.scaleFactor),
    height: Math.round(d.size.height * d.scaleFactor),
    count: screen.getAllDisplays().length,
  };
}

export function registerIpc(s: Services): void {
  const notifyLibrary = () => s.studioWindow()?.webContents.send(IPC.libraryChanged);

  ipcMain.handle(IPC.platformCapabilities, () => s.platform.capabilities());
  ipcMain.handle(IPC.platformDisplays, () =>
    screen.getAllDisplays().map((d) => ({
      id: d.id,
      width: Math.round(d.size.width * d.scaleFactor),
      height: Math.round(d.size.height * d.scaleFactor),
      scaleFactor: d.scaleFactor,
      primary: d.id === screen.getPrimaryDisplay().id,
    })),
  );

  ipcMain.handle(IPC.themesList, async () => {
    return s.store.list();
  });
  ipcMain.handle(IPC.themesLoad, (_e, id: string) => s.store.load(String(id)));
  ipcMain.handle(IPC.themesSave, async (_e, theme: unknown) => {
    const t = requireTheme(theme);
    await s.store.save(t);
    notifyLibrary();
    if (s.host.activeTheme?.id === t.id) await s.host.show(t);
  });
  ipcMain.handle(IPC.themesRemove, async (_e, id: string) => {
    if (s.host.activeTheme?.id === id) s.host.stop();
    await s.store.remove(String(id));
    notifyLibrary();
  });
  ipcMain.handle(IPC.themesDuplicate, async (_e, id: string, name: string) => {
    const theme = await s.store.duplicate(String(id), String(name));
    notifyLibrary();
    return theme;
  });
  ipcMain.handle(IPC.themesImportArtwork, async (_e, paths: string[], title?: string) => {
    const result = await s.store.importArtwork(paths.map(String), title, s.settings.get().authorName);
    if (result.theme) notifyLibrary();
    return result;
  });
  ipcMain.handle(IPC.themesAddAsset, async (_e, themeId: string, path: string) => {
    const { key, asset } = await s.store.addAsset(String(themeId), String(path));
    return { key, asset, url: themeFileUrl(String(themeId), asset.file) };
  });
  ipcMain.handle(IPC.themesCapturePreview, async (event, themeId: string, rect: Electron.Rectangle) => {
    const r = { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) };
    const image = await event.sender.capturePage(r);
    const resized = image.resize({ width: 1280, quality: 'best' });
    let jpeg = resized.toJPEG(88);
    for (const q of [78, 65, 50]) if (jpeg.length > 1000 * 1024) jpeg = resized.toJPEG(q);
    const result = await s.store.writePreview(String(themeId), jpeg);
    notifyLibrary();
    return result;
  });
  ipcMain.handle(IPC.themesFolderSize, (_e, themeId: string) => s.store.folderSize(String(themeId)));
  ipcMain.handle(IPC.themesOpenFolder, async (_e, themeId: string) => {
    const dir = s.store.dirOf(String(themeId));
    if (dir) await shell.openPath(dir);
  });
  ipcMain.handle(IPC.themesPickFiles, async (event, kind: 'image' | 'video' | 'audio' | 'any') => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const filters =
      kind === 'image'
        ? [{ name: 'Images', extensions: [...IMAGE_EXTENSIONS] }]
        : kind === 'video'
          ? [{ name: 'Videos', extensions: [...VIDEO_EXTENSIONS] }]
          : kind === 'audio'
            ? [{ name: 'Audio', extensions: [...AUDIO_EXTENSIONS] }]
            : [{ name: 'Media', extensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, 'json', PACKAGE_EXT] }];
    const options: Electron.OpenDialogOptions = { properties: ['openFile', 'multiSelections'], filters };
    const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return res.canceled ? [] : res.filePaths;
  });

  ipcMain.handle(IPC.themesExportPackage, async (event, themeId: string) => {
    const theme = await s.store.load(String(themeId));
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const options: Electron.SaveDialogOptions = {
      defaultPath: join(app.getPath('documents'), packageFileName(theme.name)),
      filters: [{ name: 'DeskForge Theme', extensions: [PACKAGE_EXT] }],
    };
    const res = win ? await dialog.showSaveDialog(win, options) : await dialog.showSaveDialog(options);
    if (res.canceled || !res.filePath) return { ok: false };
    const path = res.filePath.toLowerCase().endsWith(`.${PACKAGE_EXT}`) ? res.filePath : `${res.filePath}.${PACKAGE_EXT}`;
    const bytes = await s.store.exportPackage(theme.id, path);
    return { ok: true, path, bytes };
  });
  ipcMain.handle(IPC.themesImportPackage, async (event, path?: string) => {
    let file = typeof path === 'string' && path ? path : null;
    if (!file) {
      const win = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      const options: Electron.OpenDialogOptions = { properties: ['openFile'], filters: [{ name: 'DeskForge Theme', extensions: [PACKAGE_EXT] }] };
      const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
      if (res.canceled || res.filePaths.length === 0) return null;
      file = res.filePaths[0];
    }
    return s.importPackage(file);
  });
  ipcMain.handle(IPC.themesRevealFile, (_e, path: string) => shell.showItemInFolder(String(path)));

  ipcMain.handle(IPC.desktopApply, async (_e, themeId: string) => {
    const theme = await s.store.load(String(themeId));
    const result = await s.platform.applySystemTheme(theme, { allowExplorerRestart: s.settings.get().allowExplorerRestart });
    if (s.platform.capabilities().liveWallpaper) await s.host.show(theme);
    await s.settings.set({ activeThemeId: theme.id });
    return result;
  });
  ipcMain.handle(IPC.desktopPreviewLive, async (_e, theme: unknown, seconds: number) => {
    await s.host.preview(requireTheme(theme), Math.max(3, Math.min(60, Number(seconds) || 10)));
  });
  ipcMain.handle(IPC.desktopStop, async () => {
    s.host.stop();
    await s.settings.set({ activeThemeId: null });
  });
  ipcMain.handle(IPC.desktopRestore, async () => {
    s.host.stop();
    await s.settings.set({ activeThemeId: null });
    return s.platform.restoreOriginal();
  });
  ipcMain.handle(IPC.desktopStatus, () => s.host.status());
  ipcMain.handle(IPC.desktopSetPaused, (_e, paused: boolean) => s.host.setManualPause(Boolean(paused)));

  ipcMain.handle(IPC.systemTweaks, () => s.platform.tweaks());
  ipcMain.handle(IPC.systemSetTweak, (_e, id: string, value: unknown) => {
    if (!isValidTweakValue(String(id), value)) return { ok: false, error: 'unknown', restartExplorer: false };
    return s.platform.setTweak(id as TweakId, value);
  });
  ipcMain.handle(IPC.systemRestartExplorer, () => s.platform.restartExplorer());
  ipcMain.handle(IPC.appsStatus, () => appsStatus());
  ipcMain.handle(IPC.appsInstall, (_e, id: string) => installApp(String(id)));
  ipcMain.handle(IPC.appsUninstall, (_e, id: string) => uninstallApp(String(id)));

  ipcMain.handle(IPC.perfProbe, async (event, theme: unknown, seconds: number) => {
    const t = requireTheme(theme);
    s.host.suspendForProbe(true);
    try {
      return await probeTheme(t, Number(seconds) || 8, (p) => event.sender.send(IPC.perfProgress, p));
    } finally {
      s.host.suspendForProbe(false);
    }
  });

  ipcMain.handle(IPC.settingsGet, () => s.settings.get());
  ipcMain.handle(IPC.settingsSet, async (_e, patch: Partial<Settings>) => {
    const next = await s.settings.set(patch ?? {});
    s.applySettingsSideEffects(next);
    s.host.setControls(controlsFromSettings(next));
    s.broadcast(IPC.settingsChanged, next);
    return next;
  });
}

export function describeActive(theme: Theme | null): string {
  if (!theme) return 'DeskForge';
  const e = estimateTheme(theme, primaryDisplayInfo());
  return `DeskForge — ${theme.name} (~${e.total.cpu}% CPU)`;
}
