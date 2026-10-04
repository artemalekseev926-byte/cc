import type { BrowserWindow } from 'electron';
import type { ApplyResult, PlatformCapabilities } from '../../shared/ipc';
import type { Theme } from '../../shared/theme/schema';

export interface ApplyOptions {
  allowExplorerRestart: boolean;
}

export interface PlatformAdapter {
  capabilities(): PlatformCapabilities;
  applySystemTheme(theme: Theme, options: ApplyOptions): Promise<ApplyResult>;
  restoreOriginal(): Promise<ApplyResult>;
  attachWallpaperWindow(win: BrowserWindow, bounds: { x: number; y: number; width: number; height: number }): boolean;
  isForegroundFullscreen(): boolean;
  onShellRestart(cb: () => void): void;
  dispose(): void;
}
