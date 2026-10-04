import { describe, expect, it } from 'vitest';
import { createEmptyTheme, createImageLayer } from '../src/shared/theme/factory';
import { parseTheme } from '../src/shared/theme/schema';
import { assetKeyFor, buildThemeFromArtwork, classifyFile, humanizeFileName } from '../src/shared/workshop/import';
import { canPublish, validateForPublish, workshopDescription } from '../src/shared/workshop/validate';

describe('artist import', () => {
  it('classifies files', () => {
    expect(classifyFile({ path: '/a/x.PNG', name: 'x.PNG', bytes: 10 }).kind).toBe('image');
    expect(classifyFile({ path: '/a/x.webm', name: 'x.webm', bytes: 10 }).kind).toBe('video');
    expect(classifyFile({ path: '/a/theme.json', name: 'theme.json', bytes: 10 }).kind).toBe('theme');
    expect(classifyFile({ path: '/a/x.psd', name: 'x.psd', bytes: 10 }).problem).toBe('import.problem.sourceFile');
    expect(classifyFile({ path: '/a/x.gif', name: 'x.gif', bytes: 10 }).warning).toBe('import.warn.gif');
    expect(classifyFile({ path: '/a/x.png', name: 'x.png', bytes: 100 * 1024 * 1024 }).problem).toBe('import.problem.imageTooBig');
  });

  it('humanizes names and creates unique asset keys', () => {
    expect(humanizeFileName('my_forest-night.mp4')).toBe('My forest night');
    expect(assetKeyFor('Forest.mp4', {})).toBe('forest');
    expect(assetKeyFor('Forest.mp4', { forest: 1 })).toBe('forest-2');
  });

  it('builds a valid theme with video at the bottom', () => {
    const theme = buildThemeFromArtwork('art', 'Art', 'Me', [
      { key: 'pic', asset: { file: 'assets/pic.png', kind: 'image', bytes: 1000, width: 1920, height: 1080 } },
      { key: 'clip', asset: { file: 'assets/clip.mp4', kind: 'video', bytes: 5000, fps: 24 } },
    ]);
    expect(parseTheme(theme).ok).toBe(true);
    expect(theme.wallpaper.layers[0].type).toBe('video');
    expect(theme.wallpaper.layers[1].visible).toBe(false);
    expect(theme.wallpaper.fpsLimit).toBe(24);
    expect(theme.colors.autoAccentFromWallpaper).toBe(true);
  });
});

describe('publish checklist', () => {
  const base = () => {
    const theme = createEmptyTheme('pub', 'Publish me');
    return { theme, title: 'Publish me', description: 'Nice', tags: ['Nature'], previewBytes: 200_000, contentBytes: 10_000_000, acceptedTerms: true };
  };

  it('passes a complete submission', () => {
    expect(canPublish(validateForPublish(base()))).toBe(true);
  });

  it('blocks missing preview, short title, missing terms and missing assets', () => {
    expect(canPublish(validateForPublish({ ...base(), previewBytes: null }))).toBe(false);
    expect(canPublish(validateForPublish({ ...base(), title: 'ab' }))).toBe(false);
    expect(canPublish(validateForPublish({ ...base(), acceptedTerms: false }))).toBe(false);
    const input = base();
    input.theme.wallpaper.layers.push(createImageLayer('missing'));
    expect(validateForPublish(input).find((c) => c.id === 'assets')?.level).toBe('error');
  });

  it('warns but allows a missing description and unused assets', () => {
    const input = { ...base(), description: '' };
    input.theme.assets.extra = { file: 'assets/extra.png', kind: 'image', bytes: 1 };
    const checks = validateForPublish(input);
    expect(checks.find((c) => c.id === 'description')?.level).toBe('warning');
    expect(checks.find((c) => c.id === 'unused')?.level).toBe('warning');
    expect(canPublish(checks)).toBe(true);
  });

  it('adds a performance badge to the Workshop description', () => {
    expect(workshopDescription('Hello', base().theme)).toMatch(/^Hello\n\n\[b\].*Performance: Light/);
  });
});
