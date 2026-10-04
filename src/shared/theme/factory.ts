import {
  THEME_SCHEMA_VERSION,
  type AudioLayer,
  type SysInfoLayer,
  type VisualizerLayer,
  type WebLayer,
  type ClockLayer,
  type GradientLayer,
  type ImageLayer,
  type Layer,
  type LayerType,
  type ParticlePreset,
  type ParticlesLayer,
  type ShaderLayer,
  type ShaderPreset,
  type SolidLayer,
  type TextLayer,
  type Theme,
  type VideoLayer,
} from './schema';

let counter = 0;
export function newId(prefix = 'l'): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createEmptyTheme(id: string, name: string, author = ''): Theme {
  const now = new Date().toISOString();
  return {
    schemaVersion: THEME_SCHEMA_VERSION,
    id,
    name,
    author,
    description: '',
    tags: [],
    version: '1.0.0',
    createdAt: now,
    updatedAt: now,
    wallpaper: {
      layers: [createGradientLayer()],
      fpsLimit: 30,
      pauseOnFullscreen: true,
      pauseOnBattery: true,
    },
    colors: {
      accent: '#6c5cff',
      mode: 'dark',
      accentOnTaskbar: false,
      accentOnTitleBars: true,
      transparency: true,
      autoAccentFromWallpaper: false,
    },
    windows: { animations: true, corners: 'default', borderColor: null, captionColor: null, captionTextColor: null },
    taskbar: { position: 'bottom', alignment: 'center', autoHide: false, size: 'default' },
    desktop: { showIcons: true, iconSize: 'medium' },
    assets: {},
  };
}

const base = (name: string) => ({ id: newId(), name, visible: true, opacity: 1, blendMode: 'normal' as const });

export function createSolidLayer(color = '#1b1d2a'): SolidLayer {
  return { ...base('Цвет'), type: 'solid', color };
}

export function createGradientLayer(colors = ['#24135f', '#6c5cff', '#00c2ff']): GradientLayer {
  return { ...base('Градиент'), type: 'gradient', colors, angle: 135, animated: true, cycleSeconds: 20 };
}

export function createImageLayer(asset: string, name = 'Картинка'): ImageLayer {
  return { ...base(name), type: 'image', asset, fit: 'cover', parallax: 0, blur: 0, slowZoom: false, beatPulse: 0 };
}

export function createVideoLayer(asset: string, name = 'Видео'): VideoLayer {
  return { ...base(name), type: 'video', asset, fit: 'cover', playbackRate: 1, sound: false, volume: 0.6 };
}

export function createVisualizerLayer(): VisualizerLayer {
  return {
    ...base('Визуализатор'),
    type: 'visualizer',
    style: 'bars',
    position: 'bottom',
    bands: 64,
    height: 0.3,
    sensitivity: 1.2,
    smoothing: 0.7,
    mirror: true,
    colorA: '#7c6cff',
    colorB: '#00e0ff',
  };
}

export function createWebLayer(url = 'https://example.com'): WebLayer {
  return { ...base('Веб-страница'), type: 'web', url, zoom: 1 };
}

export function createSysInfoLayer(): SysInfoLayer {
  return { ...base('Монитор системы'), type: 'sysinfo', showCpu: true, showRam: true, style: 'bars', position: 'top-right', color: '#ffffff', fontSize: 18 };
}

export function createAudioLayer(asset: string, name = 'Звук'): AudioLayer {
  return { ...base(name), type: 'audio', asset, volume: 0.6, fadeInSeconds: 2 };
}

const particleDefaults: Record<ParticlePreset, Pick<ParticlesLayer, 'count' | 'speed' | 'size' | 'color' | 'name'>> = {
  snow: { name: 'Снег', count: 250, speed: 1, size: 1.4, color: '#ffffff' },
  rain: { name: 'Дождь', count: 400, speed: 2.5, size: 1, color: '#a9c7ff' },
  fireflies: { name: 'Светлячки', count: 60, speed: 0.6, size: 2, color: '#ffe680' },
  stars: { name: 'Звёзды', count: 300, speed: 0.3, size: 1, color: '#ffffff' },
  bubbles: { name: 'Пузыри', count: 50, speed: 0.7, size: 3, color: '#9be7ff' },
  sakura: { name: 'Сакура', count: 90, speed: 0.8, size: 2.2, color: '#ffb7d5' },
};

export function createParticlesLayer(preset: ParticlePreset = 'snow'): ParticlesLayer {
  const d = particleDefaults[preset];
  return { ...base(d.name), type: 'particles', preset, count: d.count, speed: d.speed, size: d.size, color: d.color, interactive: false };
}

const shaderNames: Record<ShaderPreset, string> = {
  aurora: 'Северное сияние',
  waves: 'Волны',
  plasma: 'Плазма',
  nebula: 'Туманность',
  grid: 'Неоновая сетка',
};

export function createShaderLayer(preset: ShaderPreset = 'aurora'): ShaderLayer {
  return { ...base(shaderNames[preset]), type: 'shader', preset, speed: 1, colorA: '#5b2bff', colorB: '#00e0ff', quality: 0.75 };
}

export function createClockLayer(): ClockLayer {
  return {
    ...base('Часы'),
    type: 'clock',
    format: '24h',
    showDate: true,
    showSeconds: false,
    position: 'center',
    color: '#ffffff',
    fontSize: 96,
    font: 'system',
  };
}

export function createTextLayer(text = 'Привет!'): TextLayer {
  return { ...base('Надпись'), type: 'text', text, position: 'bottom-right', color: '#ffffff', fontSize: 32, font: 'system' };
}

export function createLayer(type: LayerType, asset?: string): Layer {
  switch (type) {
    case 'solid':
      return createSolidLayer();
    case 'gradient':
      return createGradientLayer();
    case 'image':
      return createImageLayer(asset ?? '');
    case 'video':
      return createVideoLayer(asset ?? '');
    case 'particles':
      return createParticlesLayer();
    case 'shader':
      return createShaderLayer();
    case 'clock':
      return createClockLayer();
    case 'text':
      return createTextLayer();
    case 'audio':
      return createAudioLayer(asset ?? '');
    case 'visualizer':
      return createVisualizerLayer();
    case 'web':
      return createWebLayer();
    case 'sysinfo':
      return createSysInfoLayer();
  }
}

export function cloneTheme(theme: Theme, id: string, name: string): Theme {
  const copy: Theme = JSON.parse(JSON.stringify(theme));
  const now = new Date().toISOString();
  copy.id = id;
  copy.name = name;
  copy.createdAt = now;
  copy.updatedAt = now;
  copy.wallpaper.layers = copy.wallpaper.layers.map((layer) => ({ ...layer, id: newId() }));
  return copy;
}
