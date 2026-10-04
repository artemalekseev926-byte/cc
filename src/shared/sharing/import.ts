import { createAudioLayer, createEmptyTheme, createImageLayer, createVideoLayer } from '../theme/factory';
import { slugify, type Asset, type Theme } from '../theme/schema';

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] as const;
export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'm4v', 'mov'] as const;
export const AUDIO_EXTENSIONS = ['mp3', 'ogg', 'oga', 'wav', 'm4a', 'aac', 'flac', 'opus'] as const;

export const LIMITS = {
  imageMaxBytes: 60 * 1024 * 1024,
  videoMaxBytes: 1024 * 1024 * 1024,
  audioMaxBytes: 200 * 1024 * 1024,
  maxFilesPerTheme: 16,
  previewMaxBytes: 1024 * 1024,
  packageMaxBytes: 2 * 1024 * 1024 * 1024,
};

export type ImportKind = 'image' | 'video' | 'audio' | 'theme' | 'unsupported';

export interface ImportCandidate {
  path: string;
  name: string;
  bytes: number;
}

export interface ClassifiedFile extends ImportCandidate {
  kind: ImportKind;
  ext: string;
  problem?: string;
  warning?: string;
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function classifyFile(file: ImportCandidate): ClassifiedFile {
  const ext = extensionOf(file.name);
  if (file.name.toLowerCase() === 'theme.json' || ext === 'deskforge') return { ...file, ext, kind: 'theme' };
  if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) {
    if (file.bytes > LIMITS.imageMaxBytes) return { ...file, ext, kind: 'image', problem: 'import.problem.imageTooBig' };
    return { ...file, ext, kind: 'image', warning: ext === 'gif' ? 'import.warn.gif' : undefined };
  }
  if ((VIDEO_EXTENSIONS as readonly string[]).includes(ext)) {
    if (file.bytes > LIMITS.videoMaxBytes) return { ...file, ext, kind: 'video', problem: 'import.problem.videoTooBig' };
    return { ...file, ext, kind: 'video', warning: ext === 'mov' ? 'import.warn.mov' : undefined };
  }
  if ((AUDIO_EXTENSIONS as readonly string[]).includes(ext)) {
    if (file.bytes > LIMITS.audioMaxBytes) return { ...file, ext, kind: 'audio', problem: 'import.problem.audioTooBig' };
    return { ...file, ext, kind: 'audio' };
  }
  if (['psd', 'kra', 'clip', 'procreate', 'xcf', 'ai', 'svg'].includes(ext)) {
    return { ...file, ext, kind: 'unsupported', problem: 'import.problem.sourceFile' };
  }
  return { ...file, ext, kind: 'unsupported', problem: 'import.problem.unknown' };
}

export function humanizeFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim();
  return base ? base[0].toUpperCase() + base.slice(1) : 'Untitled';
}

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

export function buildThemeFromArtwork(id: string, title: string, author: string, assets: ImportedAsset[]): Theme {
  const theme = createEmptyTheme(id, title, author);
  theme.wallpaper.layers = [];
  const videos = assets.filter((a) => a.asset.kind === 'video');
  const images = assets.filter((a) => a.asset.kind === 'image');
  const sounds = assets.filter((a) => a.asset.kind === 'audio');
  for (const { key, asset } of [...videos, ...images]) {
    theme.assets[key] = asset;
    const name = humanizeFileName(asset.file.split('/').pop() ?? key);
    theme.wallpaper.layers.push(asset.kind === 'video' ? createVideoLayer(key, name) : createImageLayer(key, name));
  }
  theme.wallpaper.layers.forEach((layer, i) => {
    if (i > 0) layer.visible = false;
  });
  sounds.forEach(({ key, asset }, i) => {
    theme.assets[key] = asset;
    const layer = createAudioLayer(key, humanizeFileName(asset.file.split('/').pop() ?? key));
    layer.visible = i === 0;
    theme.wallpaper.layers.push(layer);
  });
  theme.colors.autoAccentFromWallpaper = true;
  if (videos.length > 0) {
    const fps = videos[0].asset.fps;
    theme.wallpaper.fpsLimit = fps && fps <= 24 ? 24 : 30;
  }
  return theme;
}
