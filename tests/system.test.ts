import { describe, expect, it } from 'vitest';
import { CATEGORY_ICONS, TOOLS } from '../src/shared/editor/tools';
import { estimateTheme } from '../src/shared/perf/estimator';
import { classifyFile, buildThemeFromArtwork } from '../src/shared/sharing/import';
import { APP_CATALOG, findApp, installedFromWingetList } from '../src/shared/system/apps';
import { TWEAKS, isValidTweakValue } from '../src/shared/system/tweaks';
import { createAudioLayer, createEmptyTheme } from '../src/shared/theme/factory';
import { PRESETS } from '../src/shared/theme/presets';
import { parseTheme } from '../src/shared/theme/schema';
import { DEFAULT_SETTINGS, SETTINGS_RANGES, controlsFromSettings } from '../src/shared/ipc';
import { isIconName } from '../src/renderer/components/Icon';

describe('icons', () => {
  it('every tool and category uses a known icon', () => {
    for (const tool of TOOLS) expect(isIconName(tool.icon), tool.id).toBe(true);
    for (const icon of Object.values(CATEGORY_ICONS)) expect(isIconName(icon), icon).toBe(true);
    for (const t of TWEAKS) expect(isIconName(t.icon), t.id).toBe(true);
    for (const a of APP_CATALOG) expect(isIconName(a.icon), a.id).toBe(true);
  });
});

describe('audio', () => {
  it('classifies audio files and builds a theme with a sound layer', () => {
    expect(classifyFile({ path: '/a/rain.mp3', name: 'rain.mp3', bytes: 1000 }).kind).toBe('audio');
    expect(classifyFile({ path: '/a/big.wav', name: 'big.wav', bytes: 300 * 1024 * 1024 }).problem).toBe('import.problem.audioTooBig');
    const theme = buildThemeFromArtwork('art', 'Art', '', [
      { key: 'pic', asset: { file: 'assets/pic.png', kind: 'image', bytes: 1 } },
      { key: 'rain', asset: { file: 'assets/rain.mp3', kind: 'audio', bytes: 1 } },
    ]);
    expect(parseTheme(theme).ok).toBe(true);
    expect(theme.wallpaper.layers.map((l) => l.type)).toEqual(['image', 'audio']);
    expect(theme.wallpaper.layers[1].visible).toBe(true);
  });

  it('audio layers are cheap and reference their asset', () => {
    const theme = createEmptyTheme('sound', 'Sound');
    theme.assets.rain = { file: 'assets/rain.mp3', kind: 'audio', bytes: 4_000_000 };
    theme.wallpaper.layers = [createAudioLayer('rain')];
    expect(parseTheme(theme).ok).toBe(true);
    const cost = estimateTheme(theme).layers[0];
    expect(cost.gpu).toBe(0);
    expect(cost.cpu).toBeLessThan(1);
    theme.wallpaper.layers = [createAudioLayer('missing')];
    expect(parseTheme(theme).ok).toBe(false);
  });
});

describe('presets', () => {
  it('ships at least 14 valid templates with unique ids', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(14);
    expect(new Set(PRESETS.map((p) => p.theme.id)).size).toBe(PRESETS.length);
    for (const p of PRESETS) expect(parseTheme(p.theme).ok, p.theme.id).toBe(true);
  });
});

describe('system tweaks', () => {
  it('validates values against the tweak definition', () => {
    expect(isValidTweakValue('fileExtensions', true)).toBe(true);
    expect(isValidTweakValue('fileExtensions', 'yes')).toBe(false);
    expect(isValidTweakValue('searchBox', 'icon')).toBe(true);
    expect(isValidTweakValue('searchBox', 'huge')).toBe(false);
    expect(isValidTweakValue('formatDisk', true)).toBe(false);
  });
});

describe('app catalog', () => {
  it('has unique, well-formed winget ids', () => {
    expect(new Set(APP_CATALOG.map((a) => a.id)).size).toBe(APP_CATALOG.length);
    for (const a of APP_CATALOG) {
      expect(a.wingetId).toMatch(/^[A-Za-z0-9][A-Za-z0-9._-]+\.[A-Za-z0-9._-]+$/);
      expect(findApp(a.id)?.wingetId).toBe(a.wingetId);
      expect(a.homepage).toMatch(/^https:\/\//);
    }
    expect(findApp('rm -rf')).toBeUndefined();
  });

  it('detects installed apps from winget export json', () => {
    const json = JSON.stringify({ Sources: [{ Packages: [{ PackageIdentifier: 'Microsoft.PowerToys' }, { PackageIdentifier: 'charlesmilette.translucenttb' }] }] });
    expect(installedFromWingetList(json).sort()).toEqual(['powertoys', 'translucenttb']);
  });
});

describe('settings', () => {
  it('has sane defaults inside their ranges', () => {
    for (const [key, range] of Object.entries(SETTINGS_RANGES)) {
      const v = DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS] as number;
      expect(v).toBeGreaterThanOrEqual(range![0]);
      expect(v).toBeLessThanOrEqual(range![1]);
    }
    expect(controlsFromSettings(DEFAULT_SETTINGS)).toEqual({ volume: 0.7, muted: false, saturation: 1, speed: 1 });
  });
});
