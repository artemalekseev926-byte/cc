import { join } from 'node:path';
import { app, BrowserWindow, Menu, nativeImage, screen, Tray } from 'electron';
import { resolveLang, translate } from '../shared/i18n';
import type { Settings } from '../shared/ipc';
import type { SettingsStore } from './settings';
import type { WallpaperHost } from './wallpaperHost';
import { loadPage, PRELOAD } from './windows';

const FLYOUT_WIDTH = 340;
const FLYOUT_HEIGHT = 470;

export function resourcePath(file: string): string {
  return app.isPackaged ? join(process.resourcesPath, file) : join(app.getAppPath(), 'build', file);
}

export class TrayController {
  private tray: Tray | null = null;
  private flyout: BrowserWindow | null = null;
  private hiddenAt = 0;

  constructor(
    private readonly host: WallpaperHost,
    private readonly settings: SettingsStore,
    private readonly actions: { showStudio: () => void; quit: () => void; stopWallpaper: () => void },
  ) {}

  create(): void {
    this.tray = new Tray(this.icon());
    this.tray.on('click', () => this.toggleFlyout());
    this.tray.on('right-click', () => this.tray?.popUpContextMenu(this.menu()));
    this.refresh();
  }

  get flyoutWindow(): BrowserWindow | null {
    return this.flyout && !this.flyout.isDestroyed() ? this.flyout : null;
  }

  refresh(tooltip?: string): void {
    if (!this.tray) return;
    if (tooltip) this.tray.setToolTip(tooltip);
    if (process.platform !== 'win32') this.tray.setContextMenu(this.menu());
  }

  hideFlyout(): void {
    if (this.flyoutWindow?.isVisible()) {
      this.flyoutWindow.hide();
      this.hiddenAt = Date.now();
    }
  }

  private t(key: string) {
    const lang = resolveLang(this.settings.get().language, app.getLocale());
    return translate(lang, key);
  }

  private icon() {
    const image = nativeImage.createFromPath(resourcePath('tray.png'));
    if (!image.isEmpty()) return image;
    return nativeImage.createFromPath(resourcePath('icon.png')).resize({ width: 16, height: 16, quality: 'best' });
  }

  private menu(): Menu {
    const status = this.host.status();
    const s: Settings = this.settings.get();
    return Menu.buildFromTemplate([
      { label: this.t('tray.open'), click: this.actions.showStudio },
      { type: 'separator' },
      {
        label: status.pauseReason === 'manual' ? this.t('tray.resume') : this.t('tray.pause'),
        enabled: status.running,
        click: () => this.host.setManualPause(status.pauseReason !== 'manual'),
      },
      { label: this.t('tray.stop'), enabled: status.running, click: this.actions.stopWallpaper },
      {
        label: this.t('tray.mute'),
        type: 'checkbox',
        checked: s.wallpaperMuted,
        click: (item) => void this.settings.set({ wallpaperMuted: item.checked }).then(() => this.notifySettings()),
      },
      { type: 'separator' },
      {
        label: this.t('settings.startup'),
        type: 'checkbox',
        checked: s.launchAtStartup,
        enabled: process.platform === 'win32' || process.platform === 'darwin',
        click: (item) => void this.settings.set({ launchAtStartup: item.checked }).then(() => this.notifySettings()),
      },
      { type: 'separator' },
      { label: this.t('tray.quit'), click: this.actions.quit },
    ]);
  }

  private settingsListeners: Array<(s: Settings) => void> = [];

  onSettingsChangedFromTray(cb: (s: Settings) => void): void {
    this.settingsListeners.push(cb);
  }

  private notifySettings() {
    const s = this.settings.get();
    for (const cb of this.settingsListeners) cb(s);
  }

  private createFlyout(): BrowserWindow {
    const win = new BrowserWindow({
      width: FLYOUT_WIDTH,
      height: FLYOUT_HEIGHT,
      show: false,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      backgroundColor: '#151821',
      webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true },
    });
    win.on('blur', () => this.hideFlyout());
    void loadPage(win, 'tray');
    return win;
  }

  toggleFlyout(): void {
    if (this.flyoutWindow?.isVisible()) {
      this.hideFlyout();
      return;
    }
    if (Date.now() - this.hiddenAt < 250) return;
    if (!this.flyoutWindow) this.flyout = this.createFlyout();
    const win = this.flyoutWindow!;
    const trayBounds = this.tray?.getBounds() ?? { x: 0, y: 0, width: 0, height: 0 };
    const point = trayBounds.width > 0 ? { x: trayBounds.x + trayBounds.width / 2, y: trayBounds.y } : screen.getCursorScreenPoint();
    const area = screen.getDisplayNearestPoint(point).workArea;
    let x = Math.round(point.x - FLYOUT_WIDTH / 2);
    let y = point.y > area.y + area.height / 2 ? area.y + area.height - FLYOUT_HEIGHT - 8 : area.y + 8;
    x = Math.max(area.x + 8, Math.min(x, area.x + area.width - FLYOUT_WIDTH - 8));
    y = Math.max(area.y + 8, y);
    win.setBounds({ x, y, width: FLYOUT_WIDTH, height: FLYOUT_HEIGHT });
    win.show();
    win.focus();
  }

  destroy(): void {
    this.flyoutWindow?.destroy();
    this.tray?.destroy();
  }
}
