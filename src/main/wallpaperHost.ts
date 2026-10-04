import { BrowserWindow, ipcMain, powerMonitor, screen, type Display } from 'electron';
import { IPC, type DesktopStatus, type WallpaperControls } from '../shared/ipc';
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
  private controls: WallpaperControls = { volume: 0.7, muted: false, saturation: 1, speed: 1, brightness: 1, contrast: 1, hue: 0, fpsCap: 0 };
  private overrides = new Map<number, Theme>();
  private pauseWhenMaximized = true;

  constructor(private readonly platform: PlatformAdapter) {
    platform.onShellRestart(() => this.reattach());
    screen.on('display-added', () => this.rebuild());
    screen.on('display-removed', () => this.rebuild());
    screen.on('display-metrics-changed', () => this.reattach());
    ipcMain.on(IPC.wallpaperReady, (event) => {
      const surface = this.surfaces.find((s) => s.win.webContents.id === event.sender.id);
      if (!surface) return;
      surface.ready = true;
      surface.win.webContents.send(IPC.wallpaperTheme, this.themeFor(surface.displayId));
      surface.win.webContents.send(IPC.wallpaperPause, this.paused);
      surface.win.webContents.send(IPC.wallpaperControls, this.controls);
    });
  }

  setControls(controls: WallpaperControls): void {
    this.controls = controls;
    this.broadcast(IPC.wallpaperControls, controls);
  }

  setPauseWhenMaximized(on: boolean): void {
    this.pauseWhenMaximized = on;
    this.evaluatePause();
  }

  get activeTheme(): Theme | null {
    return this.theme;
  }

  usesTheme(id: string): boolean {
    return this.theme?.id === id || [...this.overrides.values()].some((t) => t.id === id);
  }

  async refreshTheme(theme: Theme): Promise<void> {
    for (const [displayId, t] of this.overrides) if (t.id === theme.id) this.overrides.set(displayId, theme);
    if (this.theme?.id === theme.id) this.theme = theme;
    this.pushThemes();
    this.startLoops();
  }

  forgetTheme(id: string): void {
    for (const [displayId, t] of [...this.overrides]) if (t.id === id) this.overrides.delete(displayId);
    if (this.theme?.id === id) this.stop();
    else this.pushThemes();
  }

  private themeFor(displayId: number): Theme | null {
    return this.overrides.get(displayId) ?? this.theme;
  }

  private pushThemes() {
    for (const s of this.surfaces) if (s.ready && !s.win.isDestroyed()) s.win.webContents.send(IPC.wallpaperTheme, this.themeFor(s.displayId));
  }

  private allThemes(): Theme[] {
    const live = new Set(screen.getAllDisplays().map((d) => d.id));
    return [this.theme, ...[...this.overrides].filter(([id]) => live.has(id)).map(([, t]) => t)].filter((t): t is Theme => t !== null);
  }

  monitorThemes(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [id, t] of this.overrides) out[String(id)] = t.id;
    return out;
  }

  async showOn(displayId: number, theme: Theme | null): Promise<void> {
    if (theme) this.overrides.set(displayId, theme);
    else this.overrides.delete(displayId);
    if (!this.theme && theme) {
      await this.show(theme);
      return;
    }
    this.pushThemes();
    this.startLoops();
    this.emitStatus();
  }

  setOverrides(overrides: Map<number, Theme>): void {
    this.overrides = overrides;
    this.pushThemes();
  }

  status(): DesktopStatus {
    return {
      activeThemeId: this.theme?.id ?? null,
      running: this.surfaces.length > 0,
      paused: this.paused,
      pauseReason: this.pauseReason,
      monitorThemes: this.monitorThemes(),
    };
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
    else this.pushThemes();
    this.startLoops();
    this.emitStatus();
  }

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
    this.overrides.clear();
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
    const primary = display.id === screen.getPrimaryDisplay().id;
    win.webContents.setAudioMuted(!primary);
    await loadPage(win, 'wallpaper', { display: String(display.id), sound: primary ? '1' : '0' });
    if (win.isDestroyed()) return;
    const attached = this.platform.attachWallpaperWindow(win, this.boundsFor(display));
    if (!attached) {
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

  private startLoops() {
    if (!this.monitorTimer) this.monitorTimer = setInterval(() => this.evaluatePause(), MONITOR_INTERVAL_MS);
    this.evaluatePause();
    const needsCursor = this.allThemes().some((t) => t.wallpaper.layers.some(
      (l) => l.visible && ((l.type === 'image' && l.parallax > 0) || (l.type === 'particles' && l.interactive)),
    ));
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
      s.win.webContents.send(IPC.wallpaperCursor, { x: (p.x - d.bounds.x) / d.bounds.width, y: (p.y - d.bounds.y) / d.bounds.height });
    }
  }

  private evaluatePause() {
    const themes = this.allThemes();
    let reason: DesktopStatus['pauseReason'] = null;
    if (this.manualPause) reason = 'manual';
    else if (themes.some((t) => t.wallpaper.pauseOnFullscreen) && this.platform.isForegroundFullscreen()) reason = 'fullscreen';
    else if (this.pauseWhenMaximized && themes.length > 0 && this.platform.isForegroundMaximized()) reason = 'maximized';
    else if (themes.some((t) => t.wallpaper.pauseOnBattery) && powerMonitor.isOnBatteryPower()) reason = 'battery';
    const paused = reason !== null;
    if (paused !== this.paused || reason !== this.pauseReason) {
      this.paused = paused;
      this.pauseReason = reason;
      this.broadcast(IPC.wallpaperPause, paused);
      this.emitStatus();
    }
  }
}
