/**
 * Places a window between the desktop wallpaper and the desktop icons — the
 * standard technique used by live-wallpaper apps.
 *
 * Sending the undocumented 0x052C message to Progman makes Explorer spawn a
 * WorkerW window behind the icon layer (SHELLDLL_DefView). Parenting our window
 * to that WorkerW renders it above the static wallpaper but below the icons.
 *
 * Windows 11 24H2 changed the layout: the WorkerW is now a child of Progman
 * instead of a sibling of the icon host, so both layouts are handled.
 */
import { win32 } from './api';

const SMTO_NORMAL = 0x0000;

export function findWallpaperHost(): number {
  const api = win32();
  if (!api) return 0;
  const progman = api.FindWindowW('Progman', null);
  if (!progman) return 0;

  // Ask Explorer to create the WorkerW (both parameter variants are used in the wild).
  api.SendMessageTimeoutW(progman, 0x052c, 0xd, 0x1, SMTO_NORMAL, 1000, [0]);
  api.SendMessageTimeoutW(progman, 0x052c, 0, 0, SMTO_NORMAL, 1000, [0]);

  // Classic layout (Windows 10 / 11 before 24H2): the WorkerW that follows the
  // top-level window hosting SHELLDLL_DefView.
  let workerw = 0;
  api.EnumWindows((hwnd) => {
    const defView = api.FindWindowExW(hwnd, 0, 'SHELLDLL_DefView', null);
    if (defView) {
      workerw = api.FindWindowExW(0, hwnd, 'WorkerW', null);
    }
    return true;
  }, 0);
  if (workerw) return workerw;

  // 24H2+ layout: WorkerW is a child of Progman.
  const child = api.FindWindowExW(progman, 0, 'WorkerW', null);
  if (child) return child;

  // Last resort: Progman itself (wallpaper will render above the static wallpaper but icons remain on top).
  return progman;
}

export function attachToDesktop(hwnd: number, bounds: { x: number; y: number; width: number; height: number }): boolean {
  const api = win32();
  if (!api) return false;
  const host = findWallpaperHost();
  if (!host) return false;
  api.SetParent(hwnd, host);
  // Coordinates are relative to the host, which spans the virtual screen.
  const SWP_NOZORDER = 0x0004;
  const SWP_NOACTIVATE = 0x0010;
  const SWP_SHOWWINDOW = 0x0040;
  api.SetWindowPos(hwnd, 0, bounds.x, bounds.y, bounds.width, bounds.height, SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW);
  return true;
}

/** The desktop icon list view (shown/hidden by the "show desktop icons" option). */
export function findDesktopListView(): number {
  const api = win32();
  if (!api) return 0;
  let listView = 0;
  api.EnumWindows((hwnd) => {
    const defView = api.FindWindowExW(hwnd, 0, 'SHELLDLL_DefView', null);
    if (defView) {
      listView = api.FindWindowExW(defView, 0, 'SysListView32', null);
      return false;
    }
    return true;
  }, 0);
  return listView;
}

/**
 * True when the foreground window covers its whole monitor (a game, a video
 * player in fullscreen, a presentation) — the wallpaper pauses to give it all
 * the resources.
 */
export function isForegroundFullscreen(): boolean {
  const api = win32();
  if (!api) return false;
  // 2 = QUNS_BUSY (fullscreen app), 3 = QUNS_RUNNING_D3D_FULL_SCREEN, 4 = QUNS_PRESENTATION_MODE
  const state = api.queryUserNotificationState();
  if (state === 2 || state === 3 || state === 4) return true;

  const fg = api.GetForegroundWindow();
  if (!fg) return false;
  const cls = api.GetClassNameW(fg);
  if (cls === 'Progman' || cls === 'WorkerW' || cls === 'Shell_TrayWnd') return false;
  const rect = api.GetWindowRect(fg);
  const monitor = api.GetMonitorRectForWindow(fg);
  if (!rect || !monitor) return false;
  return rect.left <= monitor.left && rect.top <= monitor.top && rect.right >= monitor.right && rect.bottom >= monitor.bottom;
}

/** Electron gives us the HWND as a Buffer holding a pointer. */
export function hwndFromBuffer(buf: Buffer): number {
  return buf.length >= 8 ? Number(buf.readBigUInt64LE(0)) : buf.readUInt32LE(0);
}
