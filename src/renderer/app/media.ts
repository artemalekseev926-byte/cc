/** Browser-side media helpers: metadata probing and accent-color extraction. */
import { dominantAccent } from '../../shared/color';
import type { Asset, Theme } from '../../shared/theme/schema';
import { assetResolver } from './store';

export interface MediaInfo {
  width?: number;
  height?: number;
  durationSec?: number;
  fps?: number;
}

/** Reads image/video dimensions, duration and (for video) an FPS estimate. */
export function probeMedia(url: string, kind: Asset['kind']): Promise<MediaInfo> {
  if (kind === 'image') {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({});
      img.src = url;
    });
  }
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;
    const done = (info: MediaInfo) => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      resolve(info);
    };
    const timeout = setTimeout(() => done({}), 8000);
    video.onloadedmetadata = () => {
      const base: MediaInfo = {
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        durationSec: Number.isFinite(video.duration) ? video.duration : undefined,
      };
      // Count presented frames for ~0.6 s of playback to estimate the frame rate.
      const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number; presentedFrames: number }) => void) => number };
      if (!v.requestVideoFrameCallback) {
        clearTimeout(timeout);
        done(base);
        return;
      }
      let first: { mediaTime: number; frames: number } | null = null;
      const onFrame = (_now: number, meta: { mediaTime: number; presentedFrames: number }) => {
        if (!first) first = { mediaTime: meta.mediaTime, frames: meta.presentedFrames };
        const dt = meta.mediaTime - first.mediaTime;
        if (dt >= 0.6) {
          clearTimeout(timeout);
          const fps = (meta.presentedFrames - first.frames) / dt;
          done({ ...base, fps: fps > 1 && fps < 241 ? Math.round(fps) : undefined });
          return;
        }
        v.requestVideoFrameCallback!(onFrame);
      };
      v.requestVideoFrameCallback(onFrame);
      void video.play().catch(() => {
        clearTimeout(timeout);
        done(base);
      });
    };
    video.onerror = () => {
      clearTimeout(timeout);
      done({});
    };
    video.src = url;
  });
}

/** Draws a downscaled frame of the given media into a canvas and returns its pixels. */
async function samplePixels(url: string, kind: Asset['kind']): Promise<Uint8ClampedArray | null> {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 54;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  try {
    if (kind === 'image') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      await img.decode();
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } else {
      const video = document.createElement('video');
      video.muted = true;
      video.crossOrigin = 'anonymous';
      video.src = url;
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error('video'));
      });
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
      await new Promise((r) => (video.onseeked = r));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch {
    return null;
  }
}

/** Suggests an accent color that matches the wallpaper. */
export async function extractAccent(theme: Theme): Promise<string> {
  const layers = [...theme.wallpaper.layers].reverse().filter((l) => l.visible);
  const resolve = assetResolver(theme);
  for (const layer of layers) {
    if (layer.type === 'image' || layer.type === 'video') {
      const url = resolve(layer.asset);
      if (!url) continue;
      const pixels = await samplePixels(url, layer.type);
      if (pixels) return dominantAccent(pixels, theme.colors.accent);
    }
    if (layer.type === 'shader') return layer.colorB;
    if (layer.type === 'gradient') return layer.colors[Math.floor(layer.colors.length / 2)];
  }
  return theme.colors.accent;
}
