import type { MeasuredReport } from './perf/measure';
import type { Asset, Theme } from './theme/schema';
import type { ClassifiedFile } from './sharing/import';

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
  themesExportPackage: 'themes:exportPackage',
  themesImportPackage: 'themes:importPackage',
  themesRevealFile: 'themes:revealFile',
  themesImported: 'themes:imported',
  desktopApply: 'desktop:apply',
  desktopPreviewLive: 'desktop:previewLive',
  desktopStop: 'desktop:stop',
  desktopRestore: 'desktop:restore',
  desktopStatus: 'desktop:status',
  perfProbe: 'perf:probe',
  perfProgress: 'perf:progress',
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

export type ThemeSource = 'builtin' | 'local';

export interface ThemeSummary {
  id: string;
  name: string;
  author: string;
  tags: string[];
  source: ThemeSource;
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

export interface ExportResult {
  ok: boolean;
  path?: string;
  bytes?: number;
}

export interface ImportedThemeInfo {
  id: string;
  name: string;
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
    exportPackage(themeId: string): Promise<ExportResult>;
    importPackage(path?: string): Promise<Theme | null>;
    revealFile(path: string): Promise<void>;
    pathForFile(file: File): string;
    onChanged(cb: () => void): () => void;
    onImported(cb: (info: ImportedThemeInfo) => void): () => void;
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
