import {
  createClockLayer,
  createEmptyTheme,
  createGradientLayer,
  createParticlesLayer,
  createShaderLayer,
  createSolidLayer,
  createTextLayer,
} from './factory';
import type { Theme } from './schema';

export interface Preset {
  theme: Theme;
  blurbKey: string;
}

function preset(id: string, name: string, blurbKey: string, build: (t: Theme) => void): Preset {
  const theme = createEmptyTheme(id, name, 'DeskForge');
  theme.wallpaper.layers = [];
  build(theme);
  return { theme, blurbKey };
}

export const PRESETS: Preset[] = [
  preset('builtin-aurora', 'Aurora Night', 'preset.aurora', (t) => {
    t.wallpaper.layers.push(createSolidLayer('#050816'));
    const aurora = createShaderLayer('aurora');
    aurora.colorA = '#19ff9c';
    aurora.colorB = '#6c3bff';
    t.wallpaper.layers.push(aurora);
    const stars = createParticlesLayer('stars');
    stars.count = 220;
    t.wallpaper.layers.push(stars);
    t.colors.accent = '#19c98a';
    t.tags = ['Nature', 'Space'];
  }),
  preset('builtin-winter', 'Quiet Winter', 'preset.winter', (t) => {
    t.wallpaper.layers.push(createGradientLayer(['#0f2027', '#203a43', '#2c5364']));
    t.wallpaper.layers.push(createParticlesLayer('snow'));
    const clock = createClockLayer();
    clock.position = 'top-center';
    clock.fontSize = 72;
    t.wallpaper.layers.push(clock);
    t.colors.accent = '#4fa3c7';
    t.tags = ['Seasonal', 'Minimal'];
  }),
  preset('builtin-synthwave', 'Neon Drive', 'preset.synthwave', (t) => {
    t.wallpaper.layers.push(createGradientLayer(['#12002b', '#3d0066', '#ff2e88']));
    const grid = createShaderLayer('grid');
    grid.colorA = '#ff2e88';
    grid.colorB = '#00f0ff';
    t.wallpaper.layers.push(grid);
    t.colors.accent = '#ff2e88';
    t.windows.corners = 'square';
    t.windows.borderColor = '#ff2e88';
    t.taskbar.alignment = 'left';
    t.tags = ['Cyberpunk', 'Animated'];
  }),
  preset('builtin-sakura', 'Sakura Breeze', 'preset.sakura', (t) => {
    t.wallpaper.layers.push(createGradientLayer(['#ffd1dc', '#fbc2eb', '#a6c1ee']));
    t.wallpaper.layers.push(createParticlesLayer('sakura'));
    t.colors.accent = '#e86a92';
    t.colors.mode = 'light';
    t.windows.corners = 'round';
    t.tags = ['Anime', 'Light'];
  }),
  preset('builtin-ocean', 'Deep Ocean', 'preset.ocean', (t) => {
    t.wallpaper.layers.push(createSolidLayer('#001326'));
    const waves = createShaderLayer('waves');
    waves.colorA = '#003a70';
    waves.colorB = '#00c2ff';
    waves.speed = 0.6;
    t.wallpaper.layers.push(waves);
    t.wallpaper.layers.push(createParticlesLayer('bubbles'));
    t.colors.accent = '#0094d9';
    t.tags = ['Nature', 'Animated'];
  }),
  preset('builtin-minimal', 'Pure Focus', 'preset.minimal', (t) => {
    const g = createGradientLayer(['#232526', '#414345']);
    g.animated = false;
    t.wallpaper.layers.push(g);
    const text = createTextLayer('stay focused');
    text.position = 'center';
    text.fontSize = 48;
    text.font = 'mono';
    text.opacity = 0.6;
    t.wallpaper.layers.push(text);
    t.wallpaper.fpsLimit = 15;
    t.colors.accent = '#8a8f98';
    t.desktop.showIcons = false;
    t.taskbar.autoHide = true;
    t.tags = ['Minimal', 'Dark'];
  }),
  preset('builtin-rainy-night', 'Rainy Night', 'preset.rainyNight', (t) => {
    t.wallpaper.layers.push(createGradientLayer(['#0b1026', '#1b2a4a', '#2a3d66']));
    const rain = createParticlesLayer('rain');
    rain.count = 450;
    t.wallpaper.layers.push(rain);
    const clock = createClockLayer();
    clock.position = 'bottom-right';
    clock.fontSize = 64;
    clock.opacity = 0.85;
    t.wallpaper.layers.push(clock);
    t.colors.accent = '#5b8def';
    t.tags = ['Dark', 'Seasonal'];
  }),
  preset('builtin-firefly-forest', 'Firefly Forest', 'preset.fireflyForest', (t) => {
    t.wallpaper.layers.push(createGradientLayer(['#06140d', '#0f2e1d', '#1d4a2f']));
    const fireflies = createParticlesLayer('fireflies');
    fireflies.count = 90;
    fireflies.interactive = true;
    t.wallpaper.layers.push(fireflies);
    t.colors.accent = '#7bd88f';
    t.tags = ['Nature', 'Dark'];
  }),
  preset('builtin-cosmos', 'Deep Cosmos', 'preset.cosmos', (t) => {
    t.wallpaper.layers.push(createSolidLayer('#02030a'));
    const nebula = createShaderLayer('nebula');
    nebula.colorA = '#3a1c71';
    nebula.colorB = '#ff6f91';
    nebula.speed = 0.7;
    nebula.quality = 0.5;
    t.wallpaper.layers.push(nebula);
    const stars = createParticlesLayer('stars');
    stars.count = 180;
    t.wallpaper.layers.push(stars);
    t.colors.accent = '#c06cff';
    t.tags = ['Space', 'Dark'];
  }),
  preset('builtin-plasma-pop', 'Plasma Pop', 'preset.plasmaPop', (t) => {
    const plasma = createShaderLayer('plasma');
    plasma.colorA = '#ff3cac';
    plasma.colorB = '#2b86c5';
    plasma.speed = 0.5;
    plasma.quality = 0.5;
    t.wallpaper.layers.push(plasma);
    const text = createTextLayer('make it yours');
    text.position = 'bottom-center';
    text.fontSize = 40;
    text.font = 'rounded';
    t.wallpaper.layers.push(text);
    t.colors.accent = '#ff3cac';
    t.windows.corners = 'round';
    t.tags = ['Abstract', 'Animated'];
  }),
  preset('builtin-golden-hour', 'Golden Hour', 'preset.goldenHour', (t) => {
    t.wallpaper.layers.push(createGradientLayer(['#ff9a3c', '#ff6a5a', '#7b3fa0']));
    const dust = createParticlesLayer('fireflies');
    dust.color = '#ffe3a3';
    dust.count = 50;
    dust.size = 1.4;
    t.wallpaper.layers.push(dust);
    t.colors.accent = '#ff8a3d';
    t.colors.mode = 'light';
    t.tags = ['Light', 'Nature'];
  }),
  preset('builtin-arctic', 'Arctic Lights', 'preset.arctic', (t) => {
    t.wallpaper.layers.push(createSolidLayer('#06121f'));
    const aurora = createShaderLayer('aurora');
    aurora.colorA = '#4facfe';
    aurora.colorB = '#00f2fe';
    t.wallpaper.layers.push(aurora);
    const snow = createParticlesLayer('snow');
    snow.count = 160;
    snow.speed = 0.7;
    t.wallpaper.layers.push(snow);
    t.colors.accent = '#38b6ff';
    t.tags = ['Seasonal', 'Nature'];
  }),
  preset('builtin-retro-arcade', 'Retro Arcade', 'preset.retroArcade', (t) => {
    t.wallpaper.layers.push(createGradientLayer(['#000000', '#1a0033', '#33001a']));
    const grid = createShaderLayer('grid');
    grid.colorA = '#00ff9c';
    grid.colorB = '#ffe600';
    grid.speed = 1.4;
    t.wallpaper.layers.push(grid);
    const clock = createClockLayer();
    clock.font = 'mono';
    clock.position = 'top-center';
    clock.fontSize = 56;
    clock.color = '#00ff9c';
    t.wallpaper.layers.push(clock);
    t.colors.accent = '#00d084';
    t.windows.corners = 'square';
    t.windows.borderColor = '#00ff9c';
    t.tags = ['Games', 'Cyberpunk'];
  }),
  preset('builtin-zen-clock', 'Zen Clock', 'preset.zenClock', (t) => {
    const g = createGradientLayer(['#e0eafc', '#cfdef3']);
    g.cycleSeconds = 60;
    t.wallpaper.layers.push(g);
    const clock = createClockLayer();
    clock.color = '#3d4a5c';
    clock.font = 'serif';
    clock.fontSize = 120;
    t.wallpaper.layers.push(clock);
    t.wallpaper.fpsLimit = 15;
    t.colors.accent = '#5b6b85';
    t.colors.mode = 'light';
    t.tags = ['Minimal', 'Light', 'Widgets'];
  }),
];

export function isBuiltinTheme(id: string): boolean {
  return id.startsWith('builtin-');
}
