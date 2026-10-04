import { describe, expect, it } from 'vitest';
import { cloneTheme, createEmptyTheme, createImageLayer } from '../src/shared/theme/factory';
import { PRESETS } from '../src/shared/theme/presets';
import { parseTheme, slugify } from '../src/shared/theme/schema';

describe('theme schema', () => {
  it('accepts every built-in preset', () => {
    for (const { theme } of PRESETS) {
      const result = parseTheme(theme);
      expect(result.ok, `${theme.id}: ${!result.ok ? result.errors.join(', ') : ''}`).toBe(true);
    }
  });

  it('fills defaults for optional fields', () => {
    const theme = createEmptyTheme('my-theme', 'Mine');
    const raw = JSON.parse(JSON.stringify(theme));
    delete raw.wallpaper.fpsLimit;
    delete raw.taskbar.autoHide;
    const result = parseTheme(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.theme.wallpaper.fpsLimit).toBe(30);
      expect(result.theme.taskbar.autoHide).toBe(false);
    }
  });

  it('rejects invalid colors, ids and unknown layer types', () => {
    const theme = createEmptyTheme('ok-id', 'x');
    expect(parseTheme({ ...theme, id: 'Bad Id!' }).ok).toBe(false);
    expect(parseTheme({ ...theme, colors: { ...theme.colors, accent: 'red' } }).ok).toBe(false);
    expect(parseTheme({ ...theme, wallpaper: { ...theme.wallpaper, layers: [{ id: 'a', name: 'a', type: 'laser' }] } }).ok).toBe(false);
  });

  it('rejects layers that reference missing assets', () => {
    const theme = createEmptyTheme('assets-test', 'x');
    theme.wallpaper.layers.push(createImageLayer('ghost'));
    const result = parseTheme(theme);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('ghost');
  });

  it('cloneTheme gives fresh layer ids and drops the workshop id', () => {
    const source = { ...PRESETS[0].theme, workshopId: '123' };
    const copy = cloneTheme(source, 'copy-id', 'Copy');
    expect(copy.id).toBe('copy-id');
    expect(copy.workshopId).toBeUndefined();
    const sourceIds = new Set(source.wallpaper.layers.map((l) => l.id));
    expect(copy.wallpaper.layers.every((l) => !sourceIds.has(l.id))).toBe(true);
  });

  it('slugify transliterates Cyrillic and produces valid ids', () => {
    expect(slugify('Зимний лес')).toBe('zimniy-les');
    expect(slugify('Neon Drive 2077!')).toBe('neon-drive-2077');
    expect(slugify('!!')).toMatch(/^theme-/);
    for (const name of ['Ёлка', 'a', '日本']) expect(parseTheme({ ...createEmptyTheme(slugify(name), name) }).ok).toBe(true);
  });
});
