import type { Layer, Theme } from '../theme/schema';

export interface DisplayInfo {
  width: number;
  height: number;
  count: number;
}

export interface ResourceCost {
  cpu: number;
  gpu: number;
  ram: number;
  vram: number;
}

export interface LayerCost extends ResourceCost {
  layerId: string;
  layerName: string;
  layerType: Layer['type'];
}

export type Rating = 'light' | 'medium' | 'heavy' | 'extreme';

export interface Recommendation {
  key: string;
  params?: Record<string, string | number>;
  savingPercent: number;
  layerId?: string;
}

export interface Estimate {
  total: ResourceCost;
  layers: LayerCost[];
  rating: Rating;
  score: number;
  extraWatts: number;
  recommendations: Recommendation[];
}

const REF_PIXELS = 1920 * 1080;
const MB = 1024 * 1024;

const BASELINE: ResourceCost = { cpu: 0.3, gpu: 0.3, ram: 70, vram: 24 };

const SHADER_COMPLEXITY: Record<string, number> = {
  aurora: 1.2,
  waves: 0.9,
  plasma: 0.8,
  nebula: 1.6,
  grid: 0.7,
};

const PARTICLE_COST: Record<string, number> = {
  snow: 1,
  rain: 0.8,
  fireflies: 1.6,
  stars: 0.6,
  bubbles: 1.4,
  sakura: 1.5,
};

function zero(): ResourceCost {
  return { cpu: 0, gpu: 0, ram: 0, vram: 0 };
}

function add(a: ResourceCost, b: ResourceCost): ResourceCost {
  return { cpu: a.cpu + b.cpu, gpu: a.gpu + b.gpu, ram: a.ram + b.ram, vram: a.vram + b.vram };
}

function fpsFactor(fps: number): number {
  return fps / 60;
}

export function estimateLayer(layer: Layer, theme: Theme, display: DisplayInfo): ResourceCost {
  if (!layer.visible || layer.opacity <= 0) return zero();
  const fps = theme.wallpaper.fpsLimit;
  const screenPx = display.width * display.height;
  const screenScale = (screenPx / REF_PIXELS) * display.count;
  const composite = 0.25 * screenScale * fpsFactor(fps);
  const blendPenalty = layer.blendMode === 'normal' ? 1 : 1.35;

  switch (layer.type) {
    case 'solid':
      return { cpu: 0, gpu: 0.05 * screenScale, ram: 0, vram: (screenPx * 4 * display.count) / MB };

    case 'gradient': {
      const animated = layer.animated;
      return {
        cpu: animated ? 0.3 * fpsFactor(fps) : 0.02,
        gpu: (animated ? composite * 2 : 0.1 * screenScale) * blendPenalty,
        ram: 1,
        vram: (screenPx * 4 * display.count * (animated ? 2 : 1)) / MB,
      };
    }

    case 'image': {
      const asset = theme.assets[layer.asset];
      const w = asset?.width ?? 1920;
      const h = asset?.height ?? 1080;
      const decoded = (w * h * 4) / MB;
      const moving = layer.parallax > 0 || layer.slowZoom;
      const blurCost = layer.blur > 0 ? (layer.blur / 40) * 3 * screenScale : 0;
      return {
        cpu: moving ? 0.6 * fpsFactor(fps) + (layer.parallax > 0 ? 0.4 : 0) : 0.02,
        gpu: (moving ? composite * 1.5 + blurCost * fpsFactor(fps) : 0.1 * screenScale + blurCost * 0.05) * blendPenalty,
        ram: decoded * 1.2 + 4,
        vram: decoded * display.count * (moving ? 1.5 : 1),
      };
    }

    case 'video': {
      const asset = theme.assets[layer.asset];
      const w = asset?.width ?? 1920;
      const h = asset?.height ?? 1080;
      const videoFps = Math.min(asset?.fps ?? 30, 60) * layer.playbackRate;
      const pxPerSec = w * h * videoFps;
      const ref = REF_PIXELS * 30;
      const decodeLoad = pxPerSec / ref;
      const bitrateMbps = asset?.durationSec && asset.bytes ? (asset.bytes * 8) / asset.durationSec / 1_000_000 : 8;
      return {
        cpu: 0.8 + decodeLoad * 1.6 + bitrateMbps * 0.04,
        gpu: (decodeLoad * 3.5 + composite * 2) * blendPenalty,
        ram: 60 + (w * h * 1.5 * 4) / MB,
        vram: (w * h * 1.5 * 8) / MB + (screenPx * 4 * display.count) / MB,
      };
    }

    case 'particles': {
      const per = PARTICLE_COST[layer.preset] ?? 1;
      const load = layer.count * per * layer.size;
      return {
        cpu: 0.15 + (layer.count * per * 0.0045 + (layer.interactive ? 0.4 : 0)) * fpsFactor(fps),
        gpu: (composite + load * 0.0012 * screenScale * fpsFactor(fps)) * blendPenalty,
        ram: 3 + layer.count * 0.002,
        vram: (screenPx * 4 * display.count) / MB,
      };
    }

    case 'shader': {
      const complexity = SHADER_COMPLEXITY[layer.preset] ?? 1;
      const q = layer.quality * layer.quality;
      return {
        cpu: 0.25 + 0.15 * fpsFactor(fps),
        gpu: (complexity * 9 * q * screenScale * fpsFactor(fps) + composite) * blendPenalty,
        ram: 6,
        vram: (screenPx * q * 4 * display.count) / MB + 8,
      };
    }

    case 'clock':
      return { cpu: layer.showSeconds ? 0.08 : 0.03, gpu: 0.05, ram: 1, vram: 2 };

    case 'text':
      return { cpu: 0, gpu: 0.02, ram: 0.5, vram: 1 };
  }
}

export function rate(total: ResourceCost): { rating: Rating; score: number } {
  const load = total.cpu * 1.0 + total.gpu * 0.7 + Math.max(0, total.ram - 150) * 0.01 + Math.max(0, total.vram - 200) * 0.01;
  const score = Math.max(0, Math.min(100, Math.round(100 - load * 4)));
  const rating: Rating = load < 3 ? 'light' : load < 8 ? 'medium' : load < 16 ? 'heavy' : 'extreme';
  return { rating, score };
}

function round(c: ResourceCost): ResourceCost {
  return {
    cpu: Math.round(c.cpu * 10) / 10,
    gpu: Math.round(c.gpu * 10) / 10,
    ram: Math.round(c.ram),
    vram: Math.round(c.vram),
  };
}

export function estimateTheme(theme: Theme, display: DisplayInfo = { width: 1920, height: 1080, count: 1 }): Estimate {
  const layers: LayerCost[] = theme.wallpaper.layers.map((layer) => ({
    layerId: layer.id,
    layerName: layer.name,
    layerType: layer.type,
    ...round(estimateLayer(layer, theme, display)),
  }));
  const total = round(layers.reduce<ResourceCost>((acc, l) => add(acc, l), { ...BASELINE }));
  const { rating, score } = rate(total);
  const extraWatts = Math.round((total.cpu * 0.25 + total.gpu * 0.6) * 10) / 10;
  return { total, layers, rating, score, extraWatts, recommendations: recommend(theme, display, total) };
}

function recommend(theme: Theme, display: DisplayInfo, total: ResourceCost): Recommendation[] {
  const recs: Recommendation[] = [];
  const totalLoad = total.cpu + total.gpu || 1;
  const savingIf = (patch: (t: Theme) => void): number => {
    const copy: Theme = JSON.parse(JSON.stringify(theme));
    patch(copy);
    const after = estimateThemeTotal(copy, display);
    return Math.max(0, Math.round(((totalLoad - (after.cpu + after.gpu)) / totalLoad) * 100));
  };

  const fps = theme.wallpaper.fpsLimit;
  if (fps > 30) {
    const saving = savingIf((t) => (t.wallpaper.fpsLimit = 30));
    if (saving >= 5) recs.push({ key: 'rec.lowerFps', params: { from: fps, to: 30 }, savingPercent: saving });
  }

  for (const layer of theme.wallpaper.layers) {
    if (!layer.visible) continue;
    if (layer.type === 'video') {
      const a = theme.assets[layer.asset];
      if (a?.width && a.height && a.width * a.height > display.width * display.height * 1.3) {
        recs.push({
          key: 'rec.videoTooLarge',
          params: { video: `${a.width}×${a.height}`, screen: `${display.width}×${display.height}` },
          savingPercent: savingIf((t) => {
            const asset = t.assets[layer.asset];
            if (asset) {
              asset.width = display.width;
              asset.height = display.height;
            }
          }),
          layerId: layer.id,
        });
      }
      if (a?.fps && a.fps > 30) {
        recs.push({ key: 'rec.videoFps', params: { fps: Math.round(a.fps) }, savingPercent: 15, layerId: layer.id });
      }
    }
    if (layer.type === 'shader' && layer.quality > 0.5) {
      const saving = savingIf((t) => {
        const l = t.wallpaper.layers.find((x) => x.id === layer.id);
        if (l && l.type === 'shader') l.quality = 0.5;
      });
      if (saving >= 5) recs.push({ key: 'rec.shaderQuality', params: { name: layer.name }, savingPercent: saving, layerId: layer.id });
    }
    if (layer.type === 'particles' && layer.count > 600) {
      const saving = savingIf((t) => {
        const l = t.wallpaper.layers.find((x) => x.id === layer.id);
        if (l && l.type === 'particles') l.count = 300;
      });
      if (saving >= 5) recs.push({ key: 'rec.particles', params: { name: layer.name, count: layer.count }, savingPercent: saving, layerId: layer.id });
    }
    if (layer.type === 'image' && layer.blur > 0 && (layer.parallax > 0 || layer.slowZoom)) {
      recs.push({ key: 'rec.blurMotion', params: { name: layer.name }, savingPercent: 10, layerId: layer.id });
    }
  }

  if (!theme.wallpaper.pauseOnFullscreen) recs.push({ key: 'rec.pauseFullscreen', savingPercent: 0 });
  if (!theme.wallpaper.pauseOnBattery) recs.push({ key: 'rec.pauseBattery', savingPercent: 0 });

  return recs.sort((a, b) => b.savingPercent - a.savingPercent);
}

function estimateThemeTotal(theme: Theme, display: DisplayInfo): ResourceCost {
  return theme.wallpaper.layers.reduce<ResourceCost>((acc, l) => add(acc, estimateLayer(l, theme, display)), { ...BASELINE });
}
