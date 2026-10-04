import type { MeasuredReport } from './perf/measure';
import type { Asset, Theme } from './theme/schema';
import type { ClassifiedFile } from './workshop/import';

export const IPC = {
  platformCapabilities: 'platform:capabilities',
  platformDisplays: 'platform:displays',
  themesList: 'themes:list',
  themesLoad: 'themes:load',
  themesSave: 'themes:save',
  themesRemove: 'themes:remove',
  themesDuplicate: 'themes:duplicate',
  themesImportArtwork: 'themes:importArtwork',
  themesAddAsset: 'themes:addAsset',
  themesCapturePreview: 'themes:capturePreview',
  themesFolderSize: 'themes:folderSize',
  themesOpenFolder: 'themes:openFolder',
  themesPickFiles: 'themes:pickFiles',
  desktopApply: 'desktop:apply',
  desktopPreviewLive: 'desktop:previewLive',
  desktopStop: 'desktop:stop',
  desktopRestore: 'desktop:restore',
  desktopStatus: 'desktop:status',
  perfProbe: 'perf:probe',
  perfProgress: 'perf:progress',
  steamStatus: 'steam:status',
  steamPublish: 'steam:publish',
  steamPublishProgress: 'steam:publishProgress',
  steamSubscribed: 'steam:subscribed',
  steamOpenItem: 'steam:openItem',
  settingsGet: 'settings:get',
  settingsSet: 'settings:set',
  wallpaperTheme: 'wallpaper:theme',
  wallpaperPause: 'wallpaper:pause',
  wallpaperCursor: 'wallpaper:cursor',
  wallpaperFrames: 'wallpaper:frames',
  wallpaperReady: 'wallpaper:ready',
  libraryChanged: 'library:changed',
  desktopStatusChanged: 'desktop:statusChanged',
} as const;

export type OsKind = 'windows' | 'linux' | 'mac';

export interface PlatformCapabilities {
  os: OsKind;
  osVersion: string;
  isWindows11: boolean;
  liveWallpaper: boolean;
  accentColor: boolean;
  darkMode: boolean;
  transparency: boolean;
  accentOnTaskbar: boolean;
  accentOnTitleBars: boolean;
  windowAnimations: boolean;
  windowCorners: boolean;
  windowColors: boolean;
  taskbarPositions: Array<'bottom' | 'top' | 'left' | 'right'>;
  taskbarAlignment: boolean;
  taskbarAutoHide: boolean;
  taskbarSize: boolean;
  desktopIcons: boolean;
}

export interface DisplayDescriptor {
  id: number;
  width: number;
  height: number;
  scaleFactor: number;
  primary: boolean;
}

export type ThemeSource = 'builtin' | 'local' | 'workshop';

export interface ThemeSummary {
  id: string;
  name: string;
  author: string;
  tags: string[];
  source: ThemeSource;
  workshopId?: string;
  previewUrl?: string;
  updatedAt?: string;
  theme: Theme;
}

export interface ApplyStep {
  what: string;
  status: 'applied' | 'skipped' | 'failed';
  reason?: string;
}

export interface ApplyResult {
  ok: boolean;
  steps: ApplyStep[];
  explorerRestarted: boolean;
}

export interface DesktopStatus {
  activeThemeId: string | null;
  running: boolean;
  paused: boolean;
  pauseReason: 'fullscreen' | 'battery' | 'manual' | null;
}

export interface ImportArtworkResult {
  theme: Theme | null;
  files: ClassifiedFile[];
}

export interface AddAssetResult {
  key: string;
  asset: Asset;
  url: string;
}

export interface PerfProgress {
  phase: 'starting' | 'warmup' | 'measuring' | 'done';
  progress: number;
}

export interface SteamStatus {
  available: boolean;
  appId: number;
  userName?: string;
  reason?: string;
}

export interface PublishRequest {
  themeId: string;
  title: string;
  description: string;
  changeNote: string;
  tags: string[];
  visibility: 'public' | 'friends' | 'private' | 'unlisted';
}

export interface PublishProgress {
  stage: 'creating' | 'preparing' | 'uploading' | 'preview' | 'committing' | 'done' | 'error';
  progress: number;
  message?: string;
}

export interface PublishResult {
  ok: boolean;
  workshopId?: string;
  needsToAcceptAgreement?: boolean;
  error?: string;
}

export interface SubscribedItem {
  workshopId: string;
  title: string;
  installed: boolean;
  themeId?: string;
}

export type Language = 'auto' | 'ru' | 'en';

export interface Settings {
  language: Language;
  launchAtStartup: boolean;
  restoreOnExit: boolean;
  allowExplorerRestart: boolean;
  activeThemeId: string | null;
  authorName: string;
  beginnerMode: boolean;
  onboardingDone: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  launchAtStartup: false,
  restoreOnExit: false,
  allowExplorerRestart: true,
  activeThemeId: null,
  authorName: '',
  beginnerMode: true,
  onboardingDone: false,
};

export interface WallpaperFrameReport {
  frameTimesMs: number[];
}

export interface DeskforgeApi {
  platform: {
    capabilities(): Promise<PlatformCapabilities>;
    displays(): Promise<DisplayDescriptor[]>;
  };
  themes: {
    list(): Promise<ThemeSummary[]>;
    load(id: string): Promise<Theme>;
    save(theme: Theme): Promise<void>;
    remove(id: string): Promise<void>;
    duplicate(id: string, name: string): Promise<Theme>;
    importArtwork(paths: string[], title?: string): Promise<ImportArtworkResult>;
    addAsset(themeId: string, path: string): Promise<AddAssetResult>;
    capturePreview(themeId: string, rect: { x: number; y: number; width: number; height: number }): Promise<{ bytes: number; url: string }>;
    folderSize(themeId: string): Promise<number>;
    openFolder(themeId: string): Promise<void>;
    pickFiles(kind: 'image' | 'video' | 'any'): Promise<string[]>;
    pathForFile(file: File): string;
    onChanged(cb: () => void): () => void;
  };
  desktop: {
    apply(themeId: string): Promise<ApplyResult>;
    previewLive(theme: Theme, seconds: number): Promise<void>;
    stop(): Promise<void>;
    restoreOriginal(): Promise<ApplyResult>;
    status(): Promise<DesktopStatus>;
    onStatus(cb: (s: DesktopStatus) => void): () => void;
  };
  perf: {
    probe(theme: Theme, seconds: number): Promise<MeasuredReport>;
    onProgress(cb: (p: PerfProgress) => void): () => void;
  };
  steam: {
    status(): Promise<SteamStatus>;
    publish(req: PublishRequest): Promise<PublishResult>;
    onPublishProgress(cb: (p: PublishProgress) => void): () => void;
    subscribed(): Promise<SubscribedItem[]>;
    openItem(workshopId: string): Promise<void>;
  };
  settings: {
    get(): Promise<Settings>;
    set(patch: Partial<Settings>): Promise<Settings>;
  };
  wallpaper: {
    onTheme(cb: (theme: Theme | null) => void): () => void;
    onPause(cb: (paused: boolean) => void): () => void;
    onCursor(cb: (pos: { x: number; y: number }) => void): () => void;
    reportFrames(report: WallpaperFrameReport): void;
    ready(): void;
  };
}

export const ASSET_SCHEME = 'deskforge';

export function themeFileUrl(themeId: string, relativeFile: string): string {
  return `${ASSET_SCHEME}://theme/${encodeURIComponent(themeId)}/${relativeFile.split('/').map(encodeURIComponent).join('/')}`;
}
