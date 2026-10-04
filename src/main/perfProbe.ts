import { cpus } from 'node:os';
import { app, ipcMain, screen } from 'electron';
import { IPC, type PerfProgress, type WallpaperFrameReport } from '../shared/ipc';
import { buildMeasuredReport, frameStatsFromTimes, type MeasuredReport, type ProcessSample } from '../shared/perf/measure';
import type { Theme } from '../shared/theme/schema';
import { createWallpaperWindow, loadPage } from './windows';

const SAMPLE_INTERVAL_MS = 500;
const WARMUP_MS = 2500;
const PROBE_OPACITY = 0.01;

function gpuMetrics() {
  const gpu = app.getAppMetrics().find((m) => m.type === 'GPU');
  return { cpu: gpu?.cpu.percentCPUUsage ?? 0, ramMB: (gpu?.memory.workingSetSize ?? 0) / 1024 };
}

let running = false;

export async function probeTheme(theme: Theme, seconds: number, onProgress: (p: PerfProgress) => void): Promise<MeasuredReport> {
  if (running) throw new Error('A performance test is already running');
  running = true;
  const display = screen.getPrimaryDisplay();
  const measureMs = Math.max(3, Math.min(30, seconds)) * 1000;

  app.getAppMetrics();
  const idleGpuRam = gpuMetrics().ramMB;

  const win = createWallpaperWindow({
    ...display.bounds,
    opacity: PROBE_OPACITY,
    paintWhenInitiallyHidden: true,
    alwaysOnTop: false,
  });
  win.setIgnoreMouseEvents(true);

  const frameTimes: number[] = [];
  let collecting = false;
  const onFrames = (event: Electron.IpcMainEvent, report: WallpaperFrameReport) => {
    if (event.sender.id !== win.webContents.id) return;
    if (collecting && Array.isArray(report.frameTimesMs)) frameTimes.push(...report.frameTimesMs.filter((n) => typeof n === 'number'));
  };
  const onReady = (event: Electron.IpcMainEvent) => {
    if (event.sender.id !== win.webContents.id) return;
    win.webContents.send(IPC.wallpaperTheme, { ...theme, wallpaper: { ...theme.wallpaper, pauseOnBattery: false, pauseOnFullscreen: false } });
    win.webContents.send(IPC.wallpaperPause, false);
  };
  ipcMain.on(IPC.wallpaperFrames, onFrames);
  ipcMain.on(IPC.wallpaperReady, onReady);

  try {
    onProgress({ phase: 'starting', progress: 0 });
    await loadPage(win, 'wallpaper', { probe: '1' });
    win.showInactive();

    onProgress({ phase: 'warmup', progress: 0.05 });
    await new Promise((r) => setTimeout(r, WARMUP_MS));
    app.getAppMetrics();
    collecting = true;

    const pid = win.webContents.getOSProcessId();
    const samples: ProcessSample[] = [];
    const start = Date.now();
    while (Date.now() - start < measureMs) {
      await new Promise((r) => setTimeout(r, SAMPLE_INTERVAL_MS));
      if (win.isDestroyed()) throw new Error('Probe window closed');
      const metrics = app.getAppMetrics();
      const renderer = metrics.find((m) => m.pid === pid);
      const gpu = metrics.find((m) => m.type === 'GPU');
      samples.push({
        t: Date.now() - start,
        rendererCpu: renderer?.cpu.percentCPUUsage ?? 0,
        gpuCpu: gpu?.cpu.percentCPUUsage ?? 0,
        rendererRamMB: (renderer?.memory.workingSetSize ?? 0) / 1024,
        gpuRamMB: (gpu?.memory.workingSetSize ?? 0) / 1024,
      });
      onProgress({ phase: 'measuring', progress: 0.1 + 0.9 * Math.min(1, (Date.now() - start) / measureMs) });
    }
    collecting = false;
    const report = buildMeasuredReport(
      samples,
      frameStatsFromTimes(frameTimes, theme.wallpaper.fpsLimit),
      theme.wallpaper.fpsLimit,
      idleGpuRam,
      cpus().length,
    );
    onProgress({ phase: 'done', progress: 1 });
    return report;
  } finally {
    ipcMain.removeListener(IPC.wallpaperFrames, onFrames);
    ipcMain.removeListener(IPC.wallpaperReady, onReady);
    if (!win.isDestroyed()) win.destroy();
    running = false;
  }
}
