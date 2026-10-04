import { BrowserWindow, dialog, ipcMain, screen, shell } from 'electron';
import { IPC, themeFileUrl, type PublishRequest, type Settings } from '../shared/ipc';
import { estimateTheme } from '../shared/perf/estimator';
import { parseTheme, type Theme } from '../shared/theme/schema';
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from '../shared/workshop/import';
import { workshopDescription } from '../shared/workshop/validate';
import { probeTheme } from './perfProbe';
import type { PlatformAdapter } from './platform';
import type { SettingsStore } from './settings';
import type { SteamService } from './steam';
import { PREVIEW_FILE, type ThemeStore } from './storage';
import type { WallpaperHost } from './wallpaperHost';

export interface Services {
  store: ThemeStore;
  settings: SettingsStore;
  platform: PlatformAdapter;
  host: WallpaperHost;
  steam: SteamService;
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
  s.host.onStatus((status) => s.studioWindow()?.webContents.send(IPC.desktopStatusChanged, status));

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
    s.store.setWorkshopItems(s.steam.installedItems());
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
  ipcMain.handle(IPC.themesPickFiles, async (event, kind: 'image' | 'video' | 'any') => {
    const win = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const filters =
      kind === 'image'
        ? [{ name: 'Images', extensions: [...IMAGE_EXTENSIONS] }]
        : kind === 'video'
          ? [{ name: 'Videos', extensions: [...VIDEO_EXTENSIONS] }]
          : [{ name: 'Media', extensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, 'json'] }];
    const options: Electron.OpenDialogOptions = { properties: ['openFile', 'multiSelections'], filters };
    const res = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return res.canceled ? [] : res.filePaths;
  });

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

  ipcMain.handle(IPC.perfProbe, async (event, theme: unknown, seconds: number) => {
    const t = requireTheme(theme);
    s.host.suspendForProbe(true);
    try {
      return await probeTheme(t, Number(seconds) || 8, (p) => event.sender.send(IPC.perfProgress, p));
    } finally {
      s.host.suspendForProbe(false);
    }
  });

  ipcMain.handle(IPC.steamStatus, () => s.steam.status());
  ipcMain.handle(IPC.steamSubscribed, () => s.steam.subscribed());
  ipcMain.handle(IPC.steamOpenItem, (_e, id: string) => s.steam.openItem(String(id)));
  ipcMain.handle(IPC.steamPublish, async (event, req: PublishRequest) => {
    const theme = await s.store.load(String(req.themeId));
    if (s.store.sourceOf(theme.id) !== 'local') return { ok: false, error: 'steam.onlyLocal' };
    const previewBytes = await s.store.previewBytes(theme.id);
    if (previewBytes === null) return { ok: false, error: 'check.noPreview' };
    theme.name = req.title.trim();
    theme.description = req.description;
    theme.tags = req.tags.slice(0, 12);
    if (!theme.author) theme.author = s.steam.status().userName ?? s.settings.get().authorName;
    await s.store.save(theme);

    const display = primaryDisplayInfo();
    const result = await s.steam.publish(
      req,
      theme.workshopId,
      s.store.dirOf(theme.id)!,
      s.store.resolveThemeFile(theme.id, PREVIEW_FILE)!,
      workshopDescription(req.description, theme, display),
      async (workshopId) => {
        theme.workshopId = workshopId;
        await s.store.save(theme);
      },
      (p) => event.sender.send(IPC.steamPublishProgress, p),
    );
    if (result.needsToAcceptAgreement) await s.steam.openWorkshopAgreement();
    notifyLibrary();
    return result;
  });

  ipcMain.handle(IPC.settingsGet, () => s.settings.get());
  ipcMain.handle(IPC.settingsSet, async (_e, patch: Partial<Settings>) => {
    const next = await s.settings.set(patch ?? {});
    s.applySettingsSideEffects(next);
    return next;
  });
}

export function describeActive(theme: Theme | null): string {
  if (!theme) return 'DeskForge';
  const e = estimateTheme(theme, primaryDisplayInfo());
  return `DeskForge — ${theme.name} (~${e.total.cpu}% CPU)`;
}
