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
    t.tags = ['nature', 'night'];
  }),
  preset('builtin-winter', 'Quiet Winter', 'preset.winter', (t) => {
    t.wallpaper.layers.push(createGradientLayer(['#0f2027', '#203a43', '#2c5364']));
    t.wallpaper.layers.push(createParticlesLayer('snow'));
    const clock = createClockLayer();
    clock.position = 'top-center';
    clock.fontSize = 72;
    t.wallpaper.layers.push(clock);
    t.colors.accent = '#4fa3c7';
    t.tags = ['winter', 'minimal'];
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
    t.tags = ['cyberpunk', 'retro'];
  }),
  preset('builtin-sakura', 'Sakura Breeze', 'preset.sakura', (t) => {
    t.wallpaper.layers.push(createGradientLayer(['#ffd1dc', '#fbc2eb', '#a6c1ee']));
    t.wallpaper.layers.push(createParticlesLayer('sakura'));
    t.colors.accent = '#e86a92';
    t.colors.mode = 'light';
    t.windows.corners = 'round';
    t.tags = ['anime', 'spring'];
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
    t.tags = ['nature', 'calm'];
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
    t.tags = ['minimal', 'productivity'];
  }),
];

export function isBuiltinTheme(id: string): boolean {
  return id.startsWith('builtin-');
}
