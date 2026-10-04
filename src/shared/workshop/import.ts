/**
 * Artist import pipeline (pure part).
 *
 * An artist drops files onto the Workshop page; we classify them, decide which
 * ones are usable, and build a ready-to-publish theme around them. The IO part
 * (copying files, probing video metadata, generating previews) lives in the
 * main process and the renderer respectively.
 */
import { createEmptyTheme, createImageLayer, createVideoLayer } from '../theme/factory';
import { slugify, type Asset, type Theme } from '../theme/schema';

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] as const;
export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'm4v', 'mov'] as const;

/** Limits chosen to keep Workshop downloads reasonable and playback smooth. */
export const LIMITS = {
  imageMaxBytes: 60 * 1024 * 1024,
  videoMaxBytes: 1024 * 1024 * 1024,
  maxFilesPerTheme: 16,
  previewMaxBytes: 1024 * 1024, // Steam's limit for a Workshop preview image
};

export type ImportKind = 'image' | 'video' | 'theme' | 'unsupported';

export interface ImportCandidate {
  path: string;
  name: string;
  bytes: number;
}

export interface ClassifiedFile extends ImportCandidate {
  kind: ImportKind;
  ext: string;
  /** i18n key with the reason when the file cannot be used. */
  problem?: string;
  /** i18n key for a non-blocking hint (e.g. "MOV may not play everywhere"). */
  warning?: string;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function classifyFile(file: ImportCandidate): ClassifiedFile {
  const ext = extensionOf(file.name);
  if (file.name.toLowerCase() === 'theme.json') return { ...file, ext, kind: 'theme' };
  if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
    if (file.bytes > LIMITS.imageMaxBytes) return { ...file, ext, kind: 'image', problem: 'import.problem.imageTooBig' };
    return { ...file, ext, kind: 'image', warning: ext === 'gif' ? 'import.warn.gif' : undefined };
  }
  if ((VIDEO_EXTENSIONS as readonly string[]).includes(ext)) {
    if (file.bytes > LIMITS.videoMaxBytes) return { ...file, ext, kind: 'video', problem: 'import.problem.videoTooBig' };
    return { ...file, ext, kind: 'video', warning: ext === 'mov' ? 'import.warn.mov' : undefined };
  }
  if (['psd', 'kra', 'clip', 'procreate', 'xcf', 'ai', 'svg'].includes(ext)) {
    return { ...file, ext, kind: 'unsupported', problem: 'import.problem.sourceFile' };
  }
  return { ...file, ext, kind: 'unsupported', problem: 'import.problem.unknown' };
}

/** Name of the file without extension, humanized: "my_forest-night.mp4" → "My forest night". */
export function humanizeFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base ? base[0].toUpperCase() + base.slice(1) : 'Untitled';
}

/** Unique asset key derived from the file name. */
export function assetKeyFor(name: string, existing: Record<string, unknown>): string {
  const base = slugify(name.replace(/\.[^.]+$/, '')) || 'asset';
  let key = base;
  let n = 2;
  while (existing[key]) key = `${base}-${n++}`;
  return key;
}

export interface ImportedAsset {
  key: string;
  asset: Asset;
}

/**
 * Builds a theme for freshly imported artwork: videos become the base layer,
 * images go on top (or become the base when there is no video).
 */
export function buildThemeFromArtwork(id: string, title: string, author: string, assets: ImportedAsset[]): Theme {
  const theme = createEmptyTheme(id, title, author);
  theme.wallpaper.layers = [];
  const videos = assets.filter((a) => a.asset.kind === 'video');
  const images = assets.filter((a) => a.asset.kind === 'image');
  for (const { key, asset } of [...videos, ...images]) {
    theme.assets[key] = asset;
    const name = humanizeFileName(asset.file.split('/').pop() ?? key);
    theme.wallpaper.layers.push(asset.kind === 'video' ? createVideoLayer(key, name) : createImageLayer(key, name));
  }
  // Only the first media layer is fully visible; additional images are hidden so the
  // artist can decide in the editor how to combine them.
  theme.wallpaper.layers.forEach((layer, i) => {
    if (i > 0) layer.visible = false;
  });
  theme.colors.autoAccentFromWallpaper = true;
  if (videos.length > 0) {
    const fps = videos[0].asset.fps;
    theme.wallpaper.fpsLimit = fps && fps <= 24 ? 24 : 30;
  }
  return theme;
}
