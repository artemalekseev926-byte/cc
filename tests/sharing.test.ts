import { describe, expect, it } from 'vitest';
import { createEmptyTheme, createImageLayer } from '../src/shared/theme/factory';
import { parseTheme } from '../src/shared/theme/schema';
import { assetKeyFor, buildThemeFromArtwork, classifyFile, humanizeFileName } from '../src/shared/sharing/import';
import { isSafePackageEntry, packageFileName } from '../src/shared/sharing/package';
import { canExport, validateForExport } from '../src/shared/sharing/validate';

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

describe('export checklist', () => {
  const base = () => {
    const theme = createEmptyTheme('pub', 'Share me');
    return { theme, title: 'Share me', description: 'Nice', tags: ['Nature'], previewBytes: 200_000, contentBytes: 10_000_000 };
  };

  it('passes a complete theme', () => {
    expect(canExport(validateForExport(base()))).toBe(true);
  });

  it('blocks a short title and missing assets, but only warns about a missing cover', () => {
    expect(canExport(validateForExport({ ...base(), title: 'ab' }))).toBe(false);
    const noCover = validateForExport({ ...base(), previewBytes: null });
    expect(noCover.find((c) => c.id === 'preview')?.level).toBe('warning');
    expect(canExport(noCover)).toBe(true);
    const input = base();
    input.theme.wallpaper.layers.push(createImageLayer('missing'));
    expect(validateForExport(input).find((c) => c.id === 'assets')?.level).toBe('error');
  });

  it('warns but allows a missing description and unused assets', () => {
    const input = { ...base(), description: '' };
    input.theme.assets.extra = { file: 'assets/extra.png', kind: 'image', bytes: 1 };
    const checks = validateForExport(input);
    expect(checks.find((c) => c.id === 'description')?.level).toBe('warning');
    expect(checks.find((c) => c.id === 'unused')?.level).toBe('warning');
    expect(canExport(checks)).toBe(true);
  });
});

describe('.deskforge package format', () => {
  it('accepts only known entries and rejects path traversal', () => {
    expect(isSafePackageEntry('theme.json')).toBe(true);
    expect(isSafePackageEntry('preview.jpg')).toBe(true);
    expect(isSafePackageEntry('assets/forest-2.mp4')).toBe(true);
    for (const bad of ['../evil.exe', 'assets/../../x', '/etc/passwd', 'assets\\x.png', 'C:/x', 'run.bat', 'assets/sub/x.png', 'assets/.hidden']) {
      expect(isSafePackageEntry(bad), bad).toBe(false);
    }
  });

  it('builds a safe file name', () => {
    expect(packageFileName('Neon: Drive?')).toBe('Neon Drive.deskforge');
    expect(packageFileName('  ')).toBe('theme.deskforge');
  });

  it('treats .deskforge files as themes when importing', () => {
    expect(classifyFile({ path: '/a/x.deskforge', name: 'x.deskforge', bytes: 10 }).kind).toBe('theme');
  });
});
