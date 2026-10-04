import { rate, type Rating } from './estimator';

export interface ProcessSample {
  t: number;
  rendererCpu: number;
  gpuCpu: number;
  rendererRamMB: number;
  gpuRamMB: number;
}

export interface FrameStats {
  frames: number;
  avgFps: number;
  p95FrameMs: number;
  longFrames: number;
}

export interface MeasuredReport {
  durationMs: number;
  cpu: { avg: number; peak: number };
  gpuProcessCpu: { avg: number; peak: number };
  ramMB: number;
  gpuRamDeltaMB: number;
  frames: FrameStats;
  targetFps: number;
  cpuOfMachine: number;
  rating: Rating;
  score: number;
  struggling: boolean;
}

function avg(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function frameStatsFromTimes(frameTimesMs: number[], targetFps: number): FrameStats {
  const total = frameTimesMs.reduce((a, b) => a + b, 0);
  const budget = 1000 / targetFps;
  return {
    frames: frameTimesMs.length,
    avgFps: total > 0 ? Math.round((frameTimesMs.length / total) * 1000 * 10) / 10 : 0,
    p95FrameMs: Math.round(percentile(frameTimesMs, 95) * 10) / 10,
    longFrames: frameTimesMs.filter((ms) => ms > budget * 2).length,
  };
}

export function buildMeasuredReport(
  samples: ProcessSample[],
  frames: FrameStats,
  targetFps: number,
  idleGpuRamMB: number,
  cores: number,
): MeasuredReport {
  const cpu = samples.map((s) => s.rendererCpu);
  const gpu = samples.map((s) => s.gpuCpu);
  const cpuAvg = avg(cpu);
  const gpuAvg = avg(gpu);
  const ram = Math.round(avg(samples.map((s) => s.rendererRamMB)));
  const gpuRamDelta = Math.max(0, Math.round(avg(samples.map((s) => s.gpuRamMB)) - idleGpuRamMB));
  const { rating, score } = rate({ cpu: cpuAvg, gpu: gpuAvg * 2, ram, vram: gpuRamDelta });
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    durationMs: samples.length ? samples[samples.length - 1].t - samples[0].t : 0,
    cpu: { avg: r1(cpuAvg), peak: r1(Math.max(0, ...cpu)) },
    gpuProcessCpu: { avg: r1(gpuAvg), peak: r1(Math.max(0, ...gpu)) },
    ramMB: ram,
    gpuRamDeltaMB: gpuRamDelta,
    frames,
    targetFps,
    cpuOfMachine: r1(cpuAvg / Math.max(1, cores)),
    rating,
    score,
    struggling: frames.frames > 0 && frames.avgFps < targetFps * 0.85,
  };
}
