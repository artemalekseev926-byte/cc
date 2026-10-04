import type { MeasuredReport } from './perf/measure';
import type { Asset, Theme } from './theme/schema';
import type { ClassifiedFile } from './sharing/import';
import type { AppActionResult, AppsStatus } from './system/apps';
import type { SetTweakResult, TweakId, TweakState, TweakValue } from './system/tweaks';

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
  desktopSetPaused: 'desktop:setPaused',
  systemTweaks: 'system:tweaks',
  systemSetTweak: 'system:setTweak',
  systemRestartExplorer: 'system:restartExplorer',
  systemSysinfo: 'system:sysinfo',
  desktopApplyOn: 'desktop:applyOn',
  appsStatus: 'apps:status',
  appsInstall: 'apps:install',
  appsUninstall: 'apps:uninstall',
  appShowStudio: 'app:showStudio',
  appHideFlyout: 'app:hideFlyout',
  appQuit: 'app:quit',
  settingsChanged: 'settings:changed',
  wallpaperControls: 'wallpaper:controls',
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
  pauseReason: 'fullscreen' | 'maximized' | 'battery' | 'manual' | null;
  monitorThemes: Record<string, string>;
}

export interface SysInfo {
  cpu: number;
  ram: number;
  ramUsedGb: number;
  ramTotalGb: number;
}

export type PlaylistMode = 'interval' | 'dayNight';

export interface Playlist {
  enabled: boolean;
  mode: PlaylistMode;
  themeIds: string[];
  intervalMinutes: number;
  shuffle: boolean;
  dayThemeId: string | null;
  nightThemeId: string | null;
  dayStartHour: number;
  nightStartHour: number;
}

export const PLAYLIST_INTERVALS = [5, 15, 30, 60, 180, 720] as const;
export const FPS_CAPS = [0, 15, 24, 30, 60] as const;

export const DEFAULT_PLAYLIST: Playlist = {
  enabled: false,
  mode: 'interval',
  themeIds: [],
  intervalMinutes: 30,
  shuffle: false,
  dayThemeId: null,
  nightThemeId: null,
  dayStartHour: 8,
  nightStartHour: 20,
};

export function sanitizePlaylist(input: unknown): Playlist {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length < 200 ? v : null);
  const hour = (v: unknown, d: number) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 23 ? v : d);
  const ids = Array.isArray(raw.themeIds) ? raw.themeIds.map(str).filter((v): v is string => v !== null) : [];
  return {
    enabled: raw.enabled === true,
    mode: raw.mode === 'dayNight' ? 'dayNight' : 'interval',
    themeIds: [...new Set(ids)].slice(0, 100),
    intervalMinutes: typeof raw.intervalMinutes === 'number' ? Math.min(1440, Math.max(1, Math.round(raw.intervalMinutes))) : DEFAULT_PLAYLIST.intervalMinutes,
    shuffle: raw.shuffle === true,
    dayThemeId: str(raw.dayThemeId),
    nightThemeId: str(raw.nightThemeId),
    dayStartHour: hour(raw.dayStartHour, DEFAULT_PLAYLIST.dayStartHour),
    nightStartHour: hour(raw.nightStartHour, DEFAULT_PLAYLIST.nightStartHour),
  };
}

export function sanitizeMonitorThemes(input: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (/^\d{1,20}$/.test(k) && typeof v === 'string' && v.length > 0 && v.length < 200) out[k] = v;
  }
  return out;
}

export function isNightAt(hour: number, p: Pick<Playlist, 'dayStartHour' | 'nightStartHour'>): boolean {
  const { dayStartHour: d, nightStartHour: n } = p;
  if (d === n) return false;
  return d < n ? hour < d || hour >= n : hour >= n && hour < d;
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
  wallpaperVolume: number;
  wallpaperMuted: boolean;
  wallpaperSaturation: number;
  wallpaperSpeed: number;
  launchCount: number;
  supportPromptDisabled: boolean;
  wallpaperBrightness: number;
  wallpaperContrast: number;
  wallpaperHue: number;
  wallpaperFpsCap: number;
  pauseWhenMaximized: boolean;
  monitorThemes: Record<string, string>;
  playlist: Playlist;
}

export const SETTINGS_RANGES: Partial<Record<keyof Settings, [number, number]>> = {
  wallpaperVolume: [0, 1],
  wallpaperSaturation: [0, 2],
  wallpaperSpeed: [0.25, 2],
  launchCount: [0, 1_000_000],
  wallpaperBrightness: [0.3, 1.5],
  wallpaperContrast: [0.5, 1.5],
  wallpaperHue: [-180, 180],
  wallpaperFpsCap: [0, 240],
};

export interface WallpaperControls {
  volume: number;
  muted: boolean;
  saturation: number;
  speed: number;
  brightness: number;
  contrast: number;
  hue: number;
  fpsCap: number;
}

export function controlsFromSettings(s: Settings): WallpaperControls {
  return {
    volume: s.wallpaperVolume,
    muted: s.wallpaperMuted,
    saturation: s.wallpaperSaturation,
    speed: s.wallpaperSpeed,
    brightness: s.wallpaperBrightness,
    contrast: s.wallpaperContrast,
    hue: s.wallpaperHue,
    fpsCap: s.wallpaperFpsCap,
  };
}

export const AUTHOR_GITHUB_URL = 'https://github.com/artemalekseev926-byte/cc';

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  launchAtStartup: false,
  restoreOnExit: false,
  allowExplorerRestart: true,
  activeThemeId: null,
  authorName: '',
  beginnerMode: true,
  onboardingDone: false,
  wallpaperVolume: 0.7,
  wallpaperMuted: false,
  wallpaperSaturation: 1,
  wallpaperSpeed: 1,
  launchCount: 0,
  supportPromptDisabled: false,
  wallpaperBrightness: 1,
  wallpaperContrast: 1,
  wallpaperHue: 0,
  wallpaperFpsCap: 0,
  pauseWhenMaximized: true,
  monitorThemes: {},
  playlist: DEFAULT_PLAYLIST,
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
    pickFiles(kind: 'image' | 'video' | 'audio' | 'any'): Promise<string[]>;
    exportPackage(themeId: string): Promise<ExportResult>;
    importPackage(path?: string): Promise<Theme | null>;
    revealFile(path: string): Promise<void>;
    pathForFile(file: File): string;
    onChanged(cb: () => void): () => void;
    onImported(cb: (info: ImportedThemeInfo) => void): () => void;
  };
  desktop: {
    apply(themeId: string): Promise<ApplyResult>;
    applyOn(themeId: string, displayId: number | null): Promise<void>;
    previewLive(theme: Theme, seconds: number): Promise<void>;
    stop(): Promise<void>;
    restoreOriginal(): Promise<ApplyResult>;
    status(): Promise<DesktopStatus>;
    setPaused(paused: boolean): Promise<void>;
    onStatus(cb: (s: DesktopStatus) => void): () => void;
  };
  system: {
    tweaks(): Promise<TweakState[]>;
    setTweak(id: TweakId, value: TweakValue): Promise<SetTweakResult>;
    restartExplorer(): Promise<void>;
    appsStatus(): Promise<AppsStatus>;
    installApp(id: string): Promise<AppActionResult>;
    uninstallApp(id: string): Promise<AppActionResult>;
    sysinfo(): Promise<SysInfo>;
  };
  app: {
    showStudio(): void;
    hideFlyout(): void;
    quit(): void;
  };
  perf: {
    probe(theme: Theme, seconds: number): Promise<MeasuredReport>;
    onProgress(cb: (p: PerfProgress) => void): () => void;
  };
  settings: {
    get(): Promise<Settings>;
    set(patch: Partial<Settings>): Promise<Settings>;
    onChanged(cb: (s: Settings) => void): () => void;
  };
  wallpaper: {
    onTheme(cb: (theme: Theme | null) => void): () => void;
    onPause(cb: (paused: boolean) => void): () => void;
    onCursor(cb: (pos: { x: number; y: number }) => void): () => void;
    onControls(cb: (controls: WallpaperControls) => void): () => void;
    reportFrames(report: WallpaperFrameReport): void;
    ready(): void;
  };
}

export const ASSET_SCHEME = 'deskforge';

export function themeFileUrl(themeId: string, relativeFile: string): string {
  return `${ASSET_SCHEME}://theme/${encodeURIComponent(themeId)}/${relativeFile.split('/').map(encodeURIComponent).join('/')}`;
}
