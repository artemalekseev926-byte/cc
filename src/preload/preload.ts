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
    pathForFile: (file) => webUtils.getPathForFile(file),
    onChanged: (cb) => listen(IPC.libraryChanged, cb),
  },
  desktop: {
    apply: (themeId) => invoke(IPC.desktopApply, themeId),
    previewLive: (theme, seconds) => invoke(IPC.desktopPreviewLive, theme, seconds),
    stop: () => invoke(IPC.desktopStop),
    restoreOriginal: () => invoke(IPC.desktopRestore),
    status: () => invoke(IPC.desktopStatus),
    onStatus: (cb) => listen(IPC.desktopStatusChanged, cb),
  },
  perf: {
    probe: (theme, seconds) => invoke(IPC.perfProbe, theme, seconds),
    onProgress: (cb) => listen(IPC.perfProgress, cb),
  },
  steam: {
    status: () => invoke(IPC.steamStatus),
    publish: (req) => invoke(IPC.steamPublish, req),
    onPublishProgress: (cb) => listen(IPC.steamPublishProgress, cb),
    subscribed: () => invoke(IPC.steamSubscribed),
    openItem: (id) => invoke(IPC.steamOpenItem, id),
  },
  settings: {
    get: () => invoke(IPC.settingsGet),
    set: (patch) => invoke(IPC.settingsSet, patch),
  },
  wallpaper: {
    onTheme: (cb) => listen(IPC.wallpaperTheme, cb),
    onPause: (cb) => listen(IPC.wallpaperPause, cb),
    onCursor: (cb) => listen(IPC.wallpaperCursor, cb),
    reportFrames: (report) => ipcRenderer.send(IPC.wallpaperFrames, report),
    ready: () => ipcRenderer.send(IPC.wallpaperReady),
  },
};

contextBridge.exposeInMainWorld('deskforge', api);
