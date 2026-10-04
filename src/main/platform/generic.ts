import { release } from 'node:os';
import type { BrowserWindow } from 'electron';
import type { ApplyResult, PlatformCapabilities } from '../../shared/ipc';
import type { Theme } from '../../shared/theme/schema';
import type { PlatformAdapter } from './types';
import { TWEAKS, type SetTweakResult, type TweakState } from '../../shared/system/tweaks';

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

  isForegroundMaximized(): boolean {
    return false;
  }

  onShellRestart(): void {
  }

  async tweaks(): Promise<TweakState[]> {
    return TWEAKS.map((t) => ({ id: t.id, value: t.kind === 'toggle' ? false : (t.options ?? [''])[0], supported: false }));
  }

  async setTweak(): Promise<SetTweakResult> {
    return { ok: false, error: 'apply.windowsOnly', restartExplorer: false };
  }

  async restartExplorer(): Promise<void> {
  }

  dispose(): void {
  }
}
