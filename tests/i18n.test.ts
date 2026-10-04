import { describe, expect, it } from 'vitest';
import { collectKeys } from '../scripts/i18n-keys.mjs';
import { CATEGORY_ORDER, TOOLS } from '../src/shared/editor/tools';
import { DICTIONARIES, resolveLang, translate } from '../src/shared/i18n';
import { PRESETS } from '../src/shared/theme/presets';
import { APP_CATALOG } from '../src/shared/system/apps';
import { TWEAKS, TWEAK_GROUPS } from '../src/shared/system/tweaks';
import { THEME_TAGS } from '../src/shared/sharing/validate';

function dynamicKeys(): string[] {
  const keys: string[] = [];
  const add = (prefix: string, values: readonly string[], suffix = '') => values.forEach((v) => keys.push(`${prefix}${v}${suffix}`));
  TOOLS.forEach((t) => keys.push(`tool.${t.id}.title`, `tool.${t.id}.desc`));
  add('category.', CATEGORY_ORDER);
  PRESETS.forEach((p) => keys.push(p.blurbKey));
  const layerTypes = ['solid', 'gradient', 'image', 'video', 'audio', 'particles', 'shader', 'clock', 'text', 'visualizer', 'web', 'sysinfo'];
  add('layer.type.', layerTypes);
  add('layer.help.', layerTypes);
  add('preset.layer.', ['snow', 'rain', 'fireflies', 'stars', 'bubbles', 'sakura', 'aurora', 'waves', 'plasma', 'nebula', 'grid']);
  add('blend.', ['normal', 'screen', 'multiply', 'overlay', 'lighten', 'darken', 'soft-light']);
  add('fit.', ['cover', 'contain', 'fill', 'center']);
  add('font.', ['system', 'serif', 'mono', 'rounded']);
  add('position.', ['top-left', 'top-center', 'top-right', 'center', 'bottom-left', 'bottom-center', 'bottom-right']);
  add('section.', ['layer', 'colors', 'windows', 'taskbar', 'desktop', 'performance', 'info']);
  const ratings = ['light', 'medium', 'heavy', 'extreme'];
  add('rating.', ratings);
  add('rating.', ratings, '.desc');
  add('check.perf.', ratings);
  add('library.source.', ['builtin', 'local']);
  add('nav.', ['library', 'editor', 'share', 'system', 'performance', 'settings']);
  add('status.paused.', ['fullscreen', 'maximized', 'battery', 'manual']);
  add('viz.style.', ['bars', 'wave', 'circle']);
  add('viz.position.', ['top', 'center', 'bottom']);
  add('sys.style.', ['bars', 'text']);
  add('tag.', THEME_TAGS);
  add('taskbar.', ['bottom', 'top', 'left', 'right']);
  add('import.package.', ['invalid', 'unsafe', 'tooBig']);
  add('perf.phase.', ['starting', 'warmup', 'measuring', 'done']);
  add('import.kind.', ['image', 'video', 'audio', 'theme', 'unsupported']);
  TWEAKS.forEach((tw) => {
    keys.push(`tweak.${tw.id}`, `tweak.${tw.id}.desc`);
    (tw.options ?? []).forEach((o) => keys.push(`tweak.${tw.id}.${o}`));
  });
  add('tweakGroup.', TWEAK_GROUPS);
  APP_CATALOG.forEach((a) => keys.push(`app.${a.id}`));
  add('apps.category.', ['look', 'taskbar', 'tools']);
  keys.push('caps.windowsOnly', 'caps.needsWin11', 'common.error');
  return keys;
}

describe('translations', () => {
  const used: string[] = [...collectKeys('src'), ...dynamicKeys()];

  it('every used key exists in Russian and English', () => {
    for (const lang of ['ru', 'en'] as const) {
      const missing = used.filter((k) => !(k in DICTIONARIES[lang]));
      expect(missing, `missing in ${lang}`).toEqual([]);
    }
  });

  it('Russian and English have the same keys and placeholders', () => {
    expect(Object.keys(DICTIONARIES.ru).sort()).toEqual(Object.keys(DICTIONARIES.en).sort());
    const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(DICTIONARIES.en)) expect(ph(DICTIONARIES.ru[key]), key).toEqual(ph(DICTIONARIES.en[key]));
  });

  it('substitutes params and falls back sensibly', () => {
    expect(translate('en', 'unit.seconds', { n: 5 })).toBe('5 s');
    expect(translate('ru', 'no.such.key')).toBe('no.such.key');
    expect(resolveLang('auto', 'ru-RU')).toBe('ru');
    expect(resolveLang('auto', 'de-DE')).toBe('en');
    expect(resolveLang('en', 'ru-RU')).toBe('en');
  });
});
