/**
 * Owns the live wallpaper windows (one per display), keeps them attached behind
 * the desktop icons, and pauses them when a fullscreen app or battery power
 * makes animation wasteful.
 */
import { BrowserWindow, ipcMain, powerMonitor, screen, type Display } from 'electron';
import { IPC, type DesktopStatus } from '../shared/ipc';
import type { Theme } from '../shared/theme/schema';
import type { PlatformAdapter } from './platform';
import { createWallpaperWindow, loadPage } from './windows';

const MONITOR_INTERVAL_MS = 2000;
const CURSOR_INTERVAL_MS = 33;

interface Surface {
  displayId: number;
  win: BrowserWindow;
  ready: boolean;
}

export class WallpaperHost {
  private surfaces: Surface[] = [];
  private theme: Theme | null = null;
  private paused = false;
  private pauseReason: DesktopStatus['pauseReason'] = null;
  private manualPause = false;
  private monitorTimer: NodeJS.Timeout | null = null;
  private cursorTimer: NodeJS.Timeout | null = null;
  private previewTimer: NodeJS.Timeout | null = null;
  private themeBeforePreview: Theme | null = null;
  private statusListeners: Array<(s: DesktopStatus) => void> = [];

  constructor(private readonly platform: PlatformAdapter) {
    platform.onShellRestart(() => this.reattach());
    screen.on('display-added', () => this.rebuild());
    screen.on('display-removed', () => this.rebuild());
    screen.on('display-metrics-changed', () => this.reattach());
    ipcMain.on(IPC.wallpaperReady, (event) => {
      const surface = this.surfaces.find((s) => s.win.webContents.id === event.sender.id);
      if (!surface) return;
      surface.ready = true;
      surface.win.webContents.send(IPC.wallpaperTheme, this.theme);
      surface.win.webContents.send(IPC.wallpaperPause, this.paused);
    });
  }

  get activeTheme(): Theme | null {
    return this.theme;
  }

  status(): DesktopStatus {
    return { activeThemeId: this.theme?.id ?? null, running: this.surfaces.length > 0, paused: this.paused, pauseReason: this.pauseReason };
  }

  onStatus(cb: (s: DesktopStatus) => void): void {
    this.statusListeners.push(cb);
  }

  private emitStatus() {
    const s = this.status();
    for (const cb of this.statusListeners) cb(s);
  }

  async show(theme: Theme): Promise<void> {
    this.cancelPreview();
    this.theme = theme;
    if (this.surfaces.length === 0) await this.rebuild();
    else this.broadcast(IPC.wallpaperTheme, theme);
    this.startLoops();
    this.emitStatus();
  }

  /** Temporarily shows a theme, then goes back to the previous one. */
  async preview(theme: Theme, seconds: number): Promise<void> {
    const previous = this.previewTimer ? this.themeBeforePreview : this.theme;
    this.cancelPreview();
    this.themeBeforePreview = previous;
    this.theme = theme;
    if (this.surfaces.length === 0) await this.rebuild();
    else this.broadcast(IPC.wallpaperTheme, theme);
    this.startLoops();
    this.previewTimer = setTimeout(() => {
      this.previewTimer = null;
      const back = this.themeBeforePreview;
      this.themeBeforePreview = null;
      if (back) void this.show(back);
      else this.stop();
    }, seconds * 1000);
  }

  private cancelPreview() {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = null;
    this.themeBeforePreview = null;
  }

  stop(): void {
    this.cancelPreview();
    this.theme = null;
    this.stopLoops();
    for (const s of this.surfaces) if (!s.win.isDestroyed()) s.win.destroy();
    this.surfaces = [];
    this.paused = false;
    this.pauseReason = null;
    this.emitStatus();
  }

  setManualPause(paused: boolean): void {
    this.manualPause = paused;
    this.evaluatePause();
  }

  /** Lets the performance probe measure without the live wallpaper competing for the GPU. */
  suspendForProbe(on: boolean): void {
    this.broadcast(IPC.wallpaperPause, on || this.paused);
  }

  private async rebuild(): Promise<void> {
    for (const s of this.surfaces) if (!s.win.isDestroyed()) s.win.destroy();
    this.surfaces = [];
    if (!this.theme) return;
    const displays = screen.getAllDisplays();
    await Promise.all(displays.map((d) => this.createSurface(d)));
  }

  private boundsFor(display: Display) {
    if (process.platform !== 'win32') return display.bounds;
    // WorkerW spans the virtual screen in physical pixels; position relative to its origin.
    const all = screen.getAllDisplays().map((d) => screen.dipToScreenRect(null, d.bounds));
    const originX = Math.min(...all.map((r) => r.x));
    const originY = Math.min(...all.map((r) => r.y));
    const r = screen.dipToScreenRect(null, display.bounds);
    return { x: r.x - originX, y: r.y - originY, width: r.width, height: r.height };
  }

  private async createSurface(display: Display): Promise<void> {
    const win = createWallpaperWindow({ ...display.bounds });
    const surface: Surface = { displayId: display.id, win, ready: false };
    this.surfaces.push(surface);
    win.webContents.setAudioMuted(true);
    await loadPage(win, 'wallpaper', { display: String(display.id) });
    if (win.isDestroyed()) return;
    const attached = this.platform.attachWallpaperWindow(win, this.boundsFor(display));
    if (!attached) {
      // Fallback: a bottom-most, click-through window covering the display.
      win.setBounds(display.bounds);
      win.setIgnoreMouseEvents(true);
      win.showInactive();
    } else if (process.platform === 'win32') {
      win.showInactive();
    }
  }

  private reattach(): void {
    const displays = screen.getAllDisplays();
    for (const s of this.surfaces) {
      const d = displays.find((x) => x.id === s.displayId);
      if (d && !s.win.isDestroyed()) this.platform.attachWallpaperWindow(s.win, this.boundsFor(d));
    }
  }

  private broadcast(channel: string, payload: unknown) {
    for (const s of this.surfaces) if (s.ready && !s.win.isDestroyed()) s.win.webContents.send(channel, payload);
  }

  // ── Background loops ────────────────────────────────────────────────

  private startLoops() {
    if (!this.monitorTimer) this.monitorTimer = setInterval(() => this.evaluatePause(), MONITOR_INTERVAL_MS);
    this.evaluatePause();
    const needsCursor = this.theme?.wallpaper.layers.some(
      (l) => l.visible && ((l.type === 'image' && l.parallax > 0) || (l.type === 'particles' && l.interactive)),
    );
    if (needsCursor && !this.cursorTimer) this.cursorTimer = setInterval(() => this.sendCursor(), CURSOR_INTERVAL_MS);
    if (!needsCursor && this.cursorTimer) {
      clearInterval(this.cursorTimer);
      this.cursorTimer = null;
    }
  }

  private stopLoops() {
    if (this.monitorTimer) clearInterval(this.monitorTimer);
    if (this.cursorTimer) clearInterval(this.cursorTimer);
    this.monitorTimer = null;
    this.cursorTimer = null;
  }

  private lastCursor = { x: -1, y: -1 };

  private sendCursor() {
    if (this.paused) return;
    const p = screen.getCursorScreenPoint();
    if (p.x === this.lastCursor.x && p.y === this.lastCursor.y) return;
    this.lastCursor = p;
    const displays = screen.getAllDisplays();
    for (const s of this.surfaces) {
      const d = displays.find((x) => x.id === s.displayId);
      if (!d || !s.ready || s.win.isDestroyed()) continue;
      // Normalized 0..1 within this display (can go outside when the cursor is on another screen).
      s.win.webContents.send(IPC.wallpaperCursor, { x: (p.x - d.bounds.x) / d.bounds.width, y: (p.y - d.bounds.y) / d.bounds.height });
    }
  }

  private evaluatePause() {
    const theme = this.theme;
    let reason: DesktopStatus['pauseReason'] = null;
    if (this.manualPause) reason = 'manual';
    else if (theme?.wallpaper.pauseOnFullscreen && this.platform.isForegroundFullscreen()) reason = 'fullscreen';
    else if (theme?.wallpaper.pauseOnBattery && powerMonitor.isOnBatteryPower()) reason = 'battery';
    const paused = reason !== null;
    if (paused !== this.paused || reason !== this.pauseReason) {
      this.paused = paused;
      this.pauseReason = reason;
      this.broadcast(IPC.wallpaperPause, paused);
      this.emitStatus();
    }
  }
}
