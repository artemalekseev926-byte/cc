import { describe, expect, it } from 'vitest';
import { estimateTheme } from '../src/shared/perf/estimator';
import { createEmptyTheme, createParticlesLayer, createShaderLayer, createSolidLayer, createVideoLayer } from '../src/shared/theme/factory';
import type { Theme } from '../src/shared/theme/schema';

function themeWith(build: (t: Theme) => void): Theme {
  const t = createEmptyTheme('perf-test', 'Perf');
  t.wallpaper.layers = [];
  build(t);
  return t;
}

const load = (t: Theme) => {
  const e = estimateTheme(t);
  return e.total.cpu + e.total.gpu;
};

describe('performance estimator', () => {
  it('rates a solid color as light', () => {
    const e = estimateTheme(themeWith((t) => t.wallpaper.layers.push(createSolidLayer())));
    expect(e.rating).toBe('light');
    expect(e.score).toBeGreaterThan(90);
  });

  it('more particles cost more', () => {
    const few = themeWith((t) => t.wallpaper.layers.push({ ...createParticlesLayer('snow'), count: 100 }));
    const many = themeWith((t) => t.wallpaper.layers.push({ ...createParticlesLayer('snow'), count: 2000 }));
    expect(load(many)).toBeGreaterThan(load(few));
  });

  it('a lower FPS limit is cheaper', () => {
    const at60 = themeWith((t) => {
      t.wallpaper.fpsLimit = 60;
      t.wallpaper.layers.push(createShaderLayer('nebula'));
    });
    const at30 = themeWith((t) => {
      t.wallpaper.fpsLimit = 30;
      t.wallpaper.layers.push(createShaderLayer('nebula'));
    });
    expect(load(at30)).toBeLessThan(load(at60));
  });

  it('hidden layers cost nothing', () => {
    const visible = themeWith((t) => t.wallpaper.layers.push(createShaderLayer('aurora')));
    const hidden = themeWith((t) => t.wallpaper.layers.push({ ...createShaderLayer('aurora'), visible: false }));
    expect(load(hidden)).toBeLessThan(load(visible));
    expect(estimateTheme(hidden).layers[0].cpu).toBe(0);
  });

  it('a 4K60 video is heavier than 1080p30 and gets recommendations', () => {
    const video = (w: number, h: number, fps: number) =>
      themeWith((t) => {
        t.assets.v = { file: 'assets/v.mp4', kind: 'video', bytes: 50_000_000, width: w, height: h, fps, durationSec: 20 };
        t.wallpaper.layers.push(createVideoLayer('v'));
      });
    const hd = video(1920, 1080, 30);
    const uhd = video(3840, 2160, 60);
    expect(load(uhd)).toBeGreaterThan(load(hd) * 2);
    const keys = estimateTheme(uhd).recommendations.map((r) => r.key);
    expect(keys).toContain('rec.videoTooLarge');
    expect(keys).toContain('rec.videoFps');
  });

  it('recommends lowering FPS and sorts by saving', () => {
    const t = themeWith((t) => {
      t.wallpaper.fpsLimit = 144;
      t.wallpaper.layers.push({ ...createShaderLayer('nebula'), quality: 1 });
      t.wallpaper.layers.push({ ...createParticlesLayer('fireflies'), count: 2500 });
    });
    const recs = estimateTheme(t).recommendations;
    expect(recs.map((r) => r.key)).toEqual(expect.arrayContaining(['rec.lowerFps', 'rec.shaderQuality', 'rec.particles']));
    for (let i = 1; i < recs.length; i++) expect(recs[i - 1].savingPercent).toBeGreaterThanOrEqual(recs[i].savingPercent);
  });

  it('scales with resolution and display count', () => {
    const t = themeWith((t) => t.wallpaper.layers.push(createShaderLayer('aurora')));
    const one = estimateTheme(t, { width: 1920, height: 1080, count: 1 }).total.gpu;
    const fourK = estimateTheme(t, { width: 3840, height: 2160, count: 1 }).total.gpu;
    const two = estimateTheme(t, { width: 1920, height: 1080, count: 2 }).total.gpu;
    expect(fourK).toBeGreaterThan(one * 2);
    expect(two).toBeGreaterThan(one * 1.5);
  });
});
