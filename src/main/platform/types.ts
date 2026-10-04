import type { BrowserWindow } from 'electron';
import type { ApplyResult, PlatformCapabilities } from '../../shared/ipc';
import type { Theme } from '../../shared/theme/schema';

export interface ApplyOptions {
  allowExplorerRestart: boolean;
}

/**
 * Everything OS-specific lives behind this interface. Windows is the primary
 * target (Steam audience); Linux/macOS get live wallpapers and the editor, and
 * report the system-level features they cannot change so the UI can grey them out.
 */
export interface PlatformAdapter {
  capabilities(): PlatformCapabilities;
  /** Applies colors / windows / taskbar / desktop settings (not the wallpaper itself). */
  applySystemTheme(theme: Theme, options: ApplyOptions): Promise<ApplyResult>;
  /** Restores the settings captured before DeskForge changed anything. */
  restoreOriginal(): Promise<ApplyResult>;
  /** Puts a wallpaper window behind the desktop icons. Returns false if not possible. */
  attachWallpaperWindow(win: BrowserWindow, bounds: { x: number; y: number; width: number; height: number }): boolean;
  /** Fullscreen app in the foreground (game, video, presentation). */
  isForegroundFullscreen(): boolean;
  /** Called after Explorer restarts so wallpaper windows can re-attach. */
  onShellRestart(cb: () => void): void;
  dispose(): void;
}
