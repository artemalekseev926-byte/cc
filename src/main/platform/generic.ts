/**
 * Linux / macOS: live wallpapers run as a desktop-level window (X11 `_NET_WM_WINDOW_TYPE_DESKTOP`
 * via Electron's `type: 'desktop'`, macOS desktop window level). System colors, window
 * styles and taskbar layout are reported as unsupported so the editor greys them out.
 */
import { release } from 'node:os';
import type { BrowserWindow } from 'electron';
import type { ApplyResult, PlatformCapabilities } from '../../shared/ipc';
import type { Theme } from '../../shared/theme/schema';
import type { PlatformAdapter } from './types';

export class GenericPlatform implements PlatformAdapter {
  capabilities(): PlatformCapabilities {
    const os = process.platform === 'darwin' ? 'mac' : 'linux';
    return {
      os,
      osVersion: `${os === 'mac' ? 'macOS' : 'Linux'} ${release()}`,
      isWindows11: false,
      liveWallpaper: true,
      accentColor: false,
      darkMode: false,
      transparency: false,
      accentOnTaskbar: false,
      accentOnTitleBars: false,
      windowAnimations: false,
      windowCorners: false,
      windowColors: false,
      taskbarPositions: [],
      taskbarAlignment: false,
      taskbarAutoHide: false,
      taskbarSize: false,
      desktopIcons: false,
    };
  }

  async applySystemTheme(_theme: Theme): Promise<ApplyResult> {
    return {
      ok: true,
      steps: [{ what: 'apply.system', status: 'skipped', reason: 'apply.windowsOnly' }],
      explorerRestarted: false,
    };
  }

  async restoreOriginal(): Promise<ApplyResult> {
    return { ok: true, steps: [{ what: 'apply.restore', status: 'applied' }], explorerRestarted: false };
  }

  attachWallpaperWindow(win: BrowserWindow, bounds: { x: number; y: number; width: number; height: number }): boolean {
    win.setBounds(bounds);
    if (process.platform === 'darwin') {
      win.setVisibleOnAllWorkspaces(true);
    }
    win.showInactive();
    return true;
  }

  isForegroundFullscreen(): boolean {
    return false;
  }

  onShellRestart(): void {
    /* no shell restarts on these platforms */
  }

  dispose(): void {
    /* nothing to clean up */
  }
}
