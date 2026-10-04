import { win32 } from './api';

const SMTO_NORMAL = 0x0000;

export function findWallpaperHost(): number {
  const api = win32();
  if (!api) return 0;
  const progman = api.FindWindowW('Progman', null);
  if (!progman) return 0;

  api.SendMessageTimeoutW(progman, 0x052c, 0xd, 0x1, SMTO_NORMAL, 1000, [0]);
  api.SendMessageTimeoutW(progman, 0x052c, 0, 0, SMTO_NORMAL, 1000, [0]);

  let workerw = 0;
  api.EnumWindows((hwnd) => {
    const defView = api.FindWindowExW(hwnd, 0, 'SHELLDLL_DefView', null);
    if (defView) {
      workerw = api.FindWindowExW(0, hwnd, 'WorkerW', null);
    }
    return true;
  }, 0);
  if (workerw) return workerw;

  const child = api.FindWindowExW(progman, 0, 'WorkerW', null);
  if (child) return child;

  return progman;
}

export function attachToDesktop(hwnd: number, bounds: { x: number; y: number; width: number; height: number }): boolean {
  const api = win32();
  if (!api) return false;
  const host = findWallpaperHost();
  if (!host) return false;
  api.SetParent(hwnd, host);
  const SWP_NOZORDER = 0x0004;
  const SWP_NOACTIVATE = 0x0010;
  const SWP_SHOWWINDOW = 0x0040;
  api.SetWindowPos(hwnd, 0, bounds.x, bounds.y, bounds.width, bounds.height, SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW);
  return true;
}

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

export function isForegroundFullscreen(): boolean {
  const api = win32();
  if (!api) return false;
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

export function hwndFromBuffer(buf: Buffer): number {
  return buf.length >= 8 ? Number(buf.readBigUInt64LE(0)) : buf.readUInt32LE(0);
}
