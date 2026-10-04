/**
 * Contract between the renderer pages and the main process. The preload script
 * exposes `window.deskforge` implementing `DeskforgeApi`; the main process
 * registers a handler for every channel in `IPC`.
 */
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
  // wallpaper host window
  wallpaperTheme: 'wallpaper:theme',
  wallpaperPause: 'wallpaper:pause',
  wallpaperCursor: 'wallpaper:cursor',
  wallpaperFrames: 'wallpaper:frames',
  wallpaperReady: 'wallpaper:ready',
  // broadcast to the studio window
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
  /** deskforge:// URL of the preview image, if one was generated. */
  previewUrl?: string;
  updatedAt?: string;
  /** Kept so the library can draw a procedural thumbnail when there is no preview image. */
  theme: Theme;
}

export interface ApplyStep {
  /** i18n key of what was applied, e.g. "apply.accent". */
  what: string;
  status: 'applied' | 'skipped' | 'failed';
  /** i18n key or raw message explaining a skip/failure. */
  reason?: string;
}

export interface ApplyResult {
  ok: boolean;
  steps: ApplyStep[];
  /** Taskbar position/size changes need Explorer to restart; we did it if allowed. */
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
  /** i18n key explaining why Steam is unavailable. */
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
  /** Restore the user's original Windows settings when DeskForge quits. */
  restoreOnExit: boolean;
  /** Restart Explorer automatically when a theme changes the taskbar position. */
  allowExplorerRestart: boolean;
  activeThemeId: string | null;
  authorName: string;
  /** Show the beginner tips and the simplified inspector. */
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
    /** Screenshots a region of the calling window (the live preview) as the theme's preview.jpg. */
    capturePreview(themeId: string, rect: { x: number; y: number; width: number; height: number }): Promise<{ bytes: number; url: string }>;
    folderSize(themeId: string): Promise<number>;
    openFolder(themeId: string): Promise<void>;
    pickFiles(kind: 'image' | 'video' | 'any'): Promise<string[]>;
    /** Resolves the absolute path of a File dropped onto the page. */
    pathForFile(file: File): string;
    onChanged(cb: () => void): () => void;
  };
  desktop: {
    apply(themeId: string): Promise<ApplyResult>;
    /** Shows an unsaved theme on the real desktop for a few seconds ("Try on my desktop"). */
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

/** URL under which a theme file is served to renderer pages. */
export function themeFileUrl(themeId: string, relativeFile: string): string {
  return `${ASSET_SCHEME}://theme/${encodeURIComponent(themeId)}/${relativeFile.split('/').map(encodeURIComponent).join('/')}`;
}
