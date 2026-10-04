import type { BrowserWindow } from 'electron';
import type { ApplyResult, PlatformCapabilities } from '../../shared/ipc';
import type { Theme } from '../../shared/theme/schema';
import type { SetTweakResult, TweakId, TweakState, TweakValue } from '../../shared/system/tweaks';

export interface ApplyOptions {
  allowExplorerRestart: boolean;
}

export interface PlatformAdapter {
  capabilities(): PlatformCapabilities;
  applySystemTheme(theme: Theme, options: ApplyOptions): Promise<ApplyResult>;
  restoreOriginal(): Promise<ApplyResult>;
  attachWallpaperWindow(win: BrowserWindow, bounds: { x: number; y: number; width: number; height: number }): boolean;
  isForegroundFullscreen(): boolean;
  isForegroundMaximized(): boolean;
  onShellRestart(cb: () => void): void;
  tweaks(): Promise<TweakState[]>;
  setTweak(id: TweakId, value: TweakValue): Promise<SetTweakResult>;
  restartExplorer(): Promise<void>;
  dispose(): void;
}
