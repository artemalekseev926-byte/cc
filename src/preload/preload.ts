import { contextBridge, ipcRenderer, webUtils, type IpcRendererEvent } from 'electron';
import { IPC, type DeskforgeApi } from '../shared/ipc';

function listen<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_e: IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

const invoke = ipcRenderer.invoke.bind(ipcRenderer);

const api: DeskforgeApi = {
  platform: {
    capabilities: () => invoke(IPC.platformCapabilities),
    displays: () => invoke(IPC.platformDisplays),
  },
  themes: {
    list: () => invoke(IPC.themesList),
    load: (id) => invoke(IPC.themesLoad, id),
    save: (theme) => invoke(IPC.themesSave, theme),
    remove: (id) => invoke(IPC.themesRemove, id),
    duplicate: (id, name) => invoke(IPC.themesDuplicate, id, name),
    importArtwork: (paths, title) => invoke(IPC.themesImportArtwork, paths, title),
    addAsset: (themeId, path) => invoke(IPC.themesAddAsset, themeId, path),
    capturePreview: (themeId, rect) => invoke(IPC.themesCapturePreview, themeId, rect),
    folderSize: (themeId) => invoke(IPC.themesFolderSize, themeId),
    openFolder: (themeId) => invoke(IPC.themesOpenFolder, themeId),
    pickFiles: (kind) => invoke(IPC.themesPickFiles, kind),
    exportPackage: (themeId) => invoke(IPC.themesExportPackage, themeId),
    importPackage: (path) => invoke(IPC.themesImportPackage, path),
    revealFile: (path) => invoke(IPC.themesRevealFile, path),
    pathForFile: (file) => webUtils.getPathForFile(file),
    onChanged: (cb) => listen(IPC.libraryChanged, cb),
    onImported: (cb) => listen(IPC.themesImported, cb),
  },
  desktop: {
    apply: (themeId) => invoke(IPC.desktopApply, themeId),
    applyOn: (themeId, displayId) => invoke(IPC.desktopApplyOn, themeId, displayId),
    previewLive: (theme, seconds) => invoke(IPC.desktopPreviewLive, theme, seconds),
    stop: () => invoke(IPC.desktopStop),
    restoreOriginal: () => invoke(IPC.desktopRestore),
    status: () => invoke(IPC.desktopStatus),
    setPaused: (paused) => invoke(IPC.desktopSetPaused, paused),
    onStatus: (cb) => listen(IPC.desktopStatusChanged, cb),
  },
  system: {
    tweaks: () => invoke(IPC.systemTweaks),
    setTweak: (id, value) => invoke(IPC.systemSetTweak, id, value),
    restartExplorer: () => invoke(IPC.systemRestartExplorer),
    appsStatus: () => invoke(IPC.appsStatus),
    installApp: (id) => invoke(IPC.appsInstall, id),
    uninstallApp: (id) => invoke(IPC.appsUninstall, id),
    sysinfo: () => invoke(IPC.systemSysinfo),
  },
  app: {
    showStudio: () => ipcRenderer.send(IPC.appShowStudio),
    hideFlyout: () => ipcRenderer.send(IPC.appHideFlyout),
    quit: () => ipcRenderer.send(IPC.appQuit),
  },
  perf: {
    probe: (theme, seconds) => invoke(IPC.perfProbe, theme, seconds),
    onProgress: (cb) => listen(IPC.perfProgress, cb),
  },
  settings: {
    get: () => invoke(IPC.settingsGet),
    set: (patch) => invoke(IPC.settingsSet, patch),
    onChanged: (cb) => listen(IPC.settingsChanged, cb),
  },
  wallpaper: {
    onTheme: (cb) => listen(IPC.wallpaperTheme, cb),
    onPause: (cb) => listen(IPC.wallpaperPause, cb),
    onCursor: (cb) => listen(IPC.wallpaperCursor, cb),
    onControls: (cb) => listen(IPC.wallpaperControls, cb),
    reportFrames: (report) => ipcRenderer.send(IPC.wallpaperFrames, report),
    ready: () => ipcRenderer.send(IPC.wallpaperReady),
  },
};

contextBridge.exposeInMainWorld('deskforge', api);
