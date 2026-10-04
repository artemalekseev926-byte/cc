import { DEFAULT_SETTINGS, type DeskforgeApi, type Settings, type ThemeSummary } from '../../shared/ipc';
import { cloneTheme } from '../../shared/theme/factory';
import { PRESETS } from '../../shared/theme/presets';
import { slugify, type Theme } from '../../shared/theme/schema';
import { buildMeasuredReport, frameStatsFromTimes } from '../../shared/perf/measure';
import { estimateTheme } from '../../shared/perf/estimator';
import { TWEAKS } from '../../shared/system/tweaks';

function createMockApi(): DeskforgeApi {
  const themes = new Map<string, Theme>();
  let settings: Settings = { ...DEFAULT_SETTINGS };
  const listeners = new Set<() => void>();
  const settingsListeners = new Set<(s: Settings) => void>();
  const changed = () => listeners.forEach((l) => l());
  const noop = () => () => undefined;
  const summaries = (): ThemeSummary[] => [
    ...PRESETS.map(({ theme }) => ({ id: theme.id, name: theme.name, author: theme.author, tags: theme.tags, source: 'builtin' as const, theme })),
    ...[...themes.values()].map((theme) => ({ id: theme.id, name: theme.name, author: theme.author, tags: theme.tags, source: 'local' as const, theme })),
  ];
  const find = (id: string) => themes.get(id) ?? PRESETS.find((p) => p.theme.id === id)?.theme;
  const uniqueId = (name: string) => {
    const base = slugify(name);
    let id = base;
    let n = 2;
    while (themes.has(id)) id = `${base}-${n++}`;
    return id;
  };
  return {
    platform: {
      capabilities: async () => ({
        os: 'windows',
        osVersion: 'Browser preview',
        isWindows11: true,
        liveWallpaper: true,
        accentColor: true,
        darkMode: true,
        transparency: true,
        accentOnTaskbar: true,
        accentOnTitleBars: true,
        windowAnimations: true,
        windowCorners: true,
        windowColors: true,
        taskbarPositions: ['bottom', 'top'],
        taskbarAlignment: true,
        taskbarAutoHide: true,
        taskbarSize: true,
        desktopIcons: true,
      }),
      displays: async () => [{ id: 1, width: 1920, height: 1080, scaleFactor: 1, primary: true }],
    },
    themes: {
      list: async () => summaries(),
      load: async (id) => JSON.parse(JSON.stringify(find(id))),
      save: async (theme) => {
        themes.set(theme.id, JSON.parse(JSON.stringify({ ...theme, updatedAt: new Date().toISOString() })));
        changed();
      },
      remove: async (id) => {
        themes.delete(id);
        changed();
      },
      duplicate: async (id, name) => {
        const copy = cloneTheme(find(id)!, uniqueId(name), name);
        themes.set(copy.id, copy);
        changed();
        return copy;
      },
      importArtwork: async () => ({ theme: null, files: [] }),
      addAsset: async () => {
        throw new Error('Importing files needs the desktop app');
      },
      capturePreview: async () => ({ bytes: 180_000, url: '' }),
      folderSize: async () => 1024 * 1024,
      openFolder: async () => undefined,
      pickFiles: async () => [],
      exportPackage: async () => ({ ok: false }),
      importPackage: async () => null,
      revealFile: async () => undefined,
      pathForFile: () => '',
      onChanged: (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      onImported: noop,
    },
    desktop: {
      apply: async () => ({ ok: true, steps: [{ what: 'apply.accent', status: 'applied' }], explorerRestarted: false }),
      previewLive: async () => undefined,
      stop: async () => undefined,
      restoreOriginal: async () => ({ ok: true, steps: [], explorerRestarted: false }),
      applyOn: async () => undefined,
      status: async () => ({ activeThemeId: null, running: false, paused: false, pauseReason: null, monitorThemes: {} }),
      setPaused: async () => undefined,
      onStatus: noop,
    },
    perf: {
      probe: async (theme) => {
        const e = estimateTheme(theme);
        const samples = Array.from({ length: 10 }, (_, i) => ({
          t: i * 500,
          rendererCpu: e.total.cpu * (0.8 + Math.random() * 0.3),
          gpuCpu: e.total.gpu * 0.4,
          rendererRamMB: e.total.ram,
          gpuRamMB: 200 + e.total.vram,
        }));
        const frames = Array.from({ length: theme.wallpaper.fpsLimit * 5 }, () => 1000 / theme.wallpaper.fpsLimit + Math.random() * 2);
        await new Promise((r) => setTimeout(r, 1200));
        return buildMeasuredReport(samples, frameStatsFromTimes(frames, theme.wallpaper.fpsLimit), theme.wallpaper.fpsLimit, 200, 8);
      },
      onProgress: noop,
    },
    system: {
      tweaks: async () =>
        TWEAKS.map((t) => ({ id: t.id, value: t.kind === 'toggle' ? t.id !== 'webSearch' : (t.options ?? [''])[1], supported: true })),
      setTweak: async (id) => ({ ok: true, restartExplorer: TWEAKS.find((t) => t.id === id)?.restartExplorer ?? false }),
      restartExplorer: async () => undefined,
      appsStatus: async () => ({ wingetAvailable: true, installed: ['powertoys'] }),
      installApp: async () => {
        await new Promise((r) => setTimeout(r, 1200));
        return { ok: true };
      },
      uninstallApp: async () => ({ ok: true }),
      sysinfo: async () => ({ cpu: 12 + Math.round(Math.random() * 20), ram: 48, ramUsedGb: 7.7, ramTotalGb: 16 }),
    },
    app: {
      showStudio: () => undefined,
      hideFlyout: () => undefined,
      quit: () => undefined,
    },
    settings: {
      get: async () => settings,
      set: async (patch) => {
        settings = { ...settings, ...patch };
        settingsListeners.forEach((l) => l(settings));
        return settings;
      },
      onChanged: (cb) => {
        settingsListeners.add(cb);
        return () => settingsListeners.delete(cb);
      },
    },
    wallpaper: {
      onTheme: noop,
      onPause: noop,
      onCursor: noop,
      onControls: noop,
      reportFrames: () => undefined,
      ready: () => undefined,
    },
  };
}

export const api: DeskforgeApi = typeof window !== 'undefined' && window.deskforge ? window.deskforge : createMockApi();
export const isDesktopApp = typeof window !== 'undefined' && !!window.deskforge;
