import { describe, expect, it } from 'vitest';
import { DEFAULT_PLAYLIST, isNightAt, sanitizeMonitorThemes, sanitizePlaylist, type Playlist } from '../src/shared/ipc';
import { nextPlaylistTheme } from '../src/shared/playlist/next';
import { estimateTheme } from '../src/shared/perf/estimator';
import { createEmptyTheme, createLayer } from '../src/shared/theme/factory';
import { isHttpsUrl, parseTheme } from '../src/shared/theme/schema';

describe('new layer types', () => {
  it('visualizer, web and sysinfo layers make a valid theme', () => {
    const theme = createEmptyTheme('test-theme', 'Test', '');
    theme.wallpaper.layers.push(createLayer('visualizer'), createLayer('web'), createLayer('sysinfo'));
    const parsed = parseTheme(theme);
    expect(parsed.ok ? [] : parsed.errors).toEqual([]);
  });

  it('web layers accept only https links', () => {
    expect(isHttpsUrl('https://example.com/page')).toBe(true);
    expect(isHttpsUrl('http://example.com')).toBe(false);
    expect(isHttpsUrl('file:///C:/Windows/win.ini')).toBe(false);
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
    const theme = createEmptyTheme('test-theme', 'Test', '');
    theme.wallpaper.layers.push({ ...createLayer('web'), url: 'file:///etc/passwd' } as never);
    expect(parseTheme(theme).ok).toBe(false);
  });

  it('estimator counts the new layers', () => {
    const base = createEmptyTheme('test-theme', 'Test', '');
    const before = estimateTheme(base).total;
    base.wallpaper.layers.push(createLayer('visualizer'), createLayer('web'));
    const after = estimateTheme(base).total;
    expect(after.cpu).toBeGreaterThan(before.cpu);
    expect(after.ram).toBeGreaterThan(before.ram);
  });
});

describe('playlist', () => {
  const clock = (h: number, minutesAgo = 0) => {
    const now = new Date(2026, 0, 1, h, 0, 0);
    return { now, lastSwitchMs: now.getTime() - minutesAgo * 60_000, random: () => 0 };
  };
  const p = (patch: Partial<Playlist>): Playlist => ({ ...DEFAULT_PLAYLIST, enabled: true, ...patch });

  it('does nothing when disabled', () => {
    expect(nextPlaylistTheme({ ...DEFAULT_PLAYLIST, themeIds: ['a', 'b'] }, 'a', clock(12, 999))).toBeNull();
  });

  it('cycles in order after the interval', () => {
    const list = p({ themeIds: ['a', 'b', 'c'], intervalMinutes: 30 });
    expect(nextPlaylistTheme(list, 'a', clock(12, 10))).toBeNull();
    expect(nextPlaylistTheme(list, 'a', clock(12, 31))).toBe('b');
    expect(nextPlaylistTheme(list, 'c', clock(12, 31))).toBe('a');
    expect(nextPlaylistTheme(list, 'other', clock(12, 0))).toBe('a');
  });

  it('shuffle never repeats the current theme', () => {
    const list = p({ themeIds: ['a', 'b'], shuffle: true });
    expect(nextPlaylistTheme(list, 'a', clock(12, 999))).toBe('b');
  });

  it('switches between day and night', () => {
    const list = p({ mode: 'dayNight', dayThemeId: 'd', nightThemeId: 'n', dayStartHour: 8, nightStartHour: 20 });
    expect(nextPlaylistTheme(list, 'n', clock(9))).toBe('d');
    expect(nextPlaylistTheme(list, 'd', clock(9))).toBeNull();
    expect(nextPlaylistTheme(list, 'd', clock(21))).toBe('n');
    expect(nextPlaylistTheme(list, 'd', clock(3))).toBe('n');
    expect(isNightAt(3, { dayStartHour: 20, nightStartHour: 2 })).toBe(true);
    expect(isNightAt(21, { dayStartHour: 20, nightStartHour: 2 })).toBe(false);
  });

  it('sanitizes untrusted settings', () => {
    const s = sanitizePlaylist({ enabled: 'yes', mode: 'evil', themeIds: ['a', 'a', 5, ''], intervalMinutes: -3, dayStartHour: 99 });
    expect(s).toMatchObject({ enabled: false, mode: 'interval', themeIds: ['a'], intervalMinutes: 1, dayStartHour: 8 });
    expect(sanitizeMonitorThemes({ '123': 'x', abc: 'y', '5': 7 })).toEqual({ '123': 'x' });
  });
});
