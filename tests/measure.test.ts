import { describe, expect, it } from 'vitest';
import { buildMeasuredReport, frameStatsFromTimes } from '../src/shared/perf/measure';

describe('measured report', () => {
  it('computes fps and long frames', () => {
    const stats = frameStatsFromTimes([33, 33, 34, 33, 100], 30);
    expect(stats.frames).toBe(5);
    expect(stats.longFrames).toBe(1);
    expect(stats.avgFps).toBeCloseTo(21.4, 0);
  });

  it('averages samples and normalizes CPU by core count', () => {
    const samples = [0, 500, 1000].map((t) => ({ t, rendererCpu: 4, gpuCpu: 1, rendererRamMB: 120, gpuRamMB: 260 }));
    const report = buildMeasuredReport(samples, frameStatsFromTimes(new Array(60).fill(33.3), 30), 30, 200, 8);
    expect(report.cpu.avg).toBe(4);
    expect(report.cpuOfMachine).toBe(0.5);
    expect(report.gpuRamDeltaMB).toBe(60);
    expect(report.durationMs).toBe(1000);
    expect(report.struggling).toBe(false);
  });

  it('flags a theme that cannot keep up', () => {
    const report = buildMeasuredReport([{ t: 0, rendererCpu: 30, gpuCpu: 10, rendererRamMB: 300, gpuRamMB: 300 }], frameStatsFromTimes(new Array(20).fill(50), 60), 60, 200, 4);
    expect(report.struggling).toBe(true);
    expect(['heavy', 'extreme']).toContain(report.rating);
  });
});
