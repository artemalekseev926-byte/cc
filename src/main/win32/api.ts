import { createRequire } from 'node:module';

type Fn = (...args: any[]) => any;

export interface Win32 {
  FindWindowW: Fn;
  FindWindowExW: Fn;
  SendMessageTimeoutW: Fn;
  SendMessageTimeoutStrW: Fn;
  EnumWindows: (cb: (hwnd: number, lparam: number) => boolean, lparam: number) => boolean;
  SetParent: Fn;
  SetWindowPos: Fn;
  ShowWindow: Fn;
  IsWindow: Fn;
  IsWindowVisible: Fn;
  GetWindowLongPtrW: Fn;
  GetClassNameW: (hwnd: number) => string;
  GetForegroundWindow: Fn;
  GetWindowRect: (hwnd: number) => Rect | null;
  GetMonitorRectForWindow: (hwnd: number) => Rect | null;
  SystemParametersInfoW: Fn;
  getAnimation: () => boolean;
  setAnimation: (on: boolean) => boolean;
  getClientAreaAnimation: () => boolean;
  setClientAreaAnimation: (on: boolean) => boolean;
  DwmSetWindowAttributeU32: (hwnd: number, attr: number, value: number) => number;
  setAutoHide: (on: boolean) => void;
  getAutoHide: () => boolean;
  queryUserNotificationState: () => number;
  broadcastSettingChange: (area: string) => void;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

let cached: Win32 | null | undefined;

export function win32(): Win32 | null {
  if (cached !== undefined) return cached;
  if (process.platform !== 'win32') return (cached = null);
  try {
    cached = bind();
  } catch (err) {
    console.error('[win32] failed to load bindings', err);
    cached = null;
  }
  return cached;
}

function bind(): Win32 {
  const require = createRequire(__filename);
  const koffi = require('koffi');

  const user32 = koffi.load('user32.dll');
  const dwmapi = koffi.load('dwmapi.dll');
  const shell32 = koffi.load('shell32.dll');

  const RECT = koffi.struct('DF_RECT', { left: 'long', top: 'long', right: 'long', bottom: 'long' });
  const MONITORINFO = koffi.struct('DF_MONITORINFO', { cbSize: 'uint32', rcMonitor: RECT, rcWork: RECT, dwFlags: 'uint32' });
  const ANIMATIONINFO = koffi.struct('DF_ANIMATIONINFO', { cbSize: 'uint32', iMinAnimate: 'int' });
  const APPBARDATA = koffi.struct('DF_APPBARDATA', {
    cbSize: 'uint32',
    hWnd: 'intptr_t',
    uCallbackMessage: 'uint32',
    uEdge: 'uint32',
    rc: RECT,
    lParam: 'intptr_t',
  });
  koffi.proto('bool __stdcall DF_EnumWindowsProc(intptr_t hwnd, intptr_t lParam)');

  const FindWindowW = user32.func('intptr_t __stdcall FindWindowW(const char16_t *cls, const char16_t *name)');
  const FindWindowExW = user32.func(
    'intptr_t __stdcall FindWindowExW(intptr_t parent, intptr_t after, const char16_t *cls, const char16_t *name)',
  );
  const SendMessageTimeoutW = user32.func(
    'intptr_t __stdcall SendMessageTimeoutW(intptr_t hwnd, uint32_t msg, uintptr_t wParam, intptr_t lParam, uint32_t flags, uint32_t timeout, _Out_ uintptr_t *result)',
  );
  const SendMessageTimeoutStr = user32.func(
    'intptr_t __stdcall SendMessageTimeoutW(intptr_t hwnd, uint32_t msg, uintptr_t wParam, const char16_t *lParam, uint32_t flags, uint32_t timeout, _Out_ uintptr_t *result)',
  );
  const EnumWindowsRaw = user32.func('bool __stdcall EnumWindows(DF_EnumWindowsProc *cb, intptr_t lParam)');
  const SetParent = user32.func('intptr_t __stdcall SetParent(intptr_t child, intptr_t parent)');
  const SetWindowPos = user32.func(
    'bool __stdcall SetWindowPos(intptr_t hwnd, intptr_t after, int x, int y, int cx, int cy, uint32_t flags)',
  );
  const ShowWindow = user32.func('bool __stdcall ShowWindow(intptr_t hwnd, int cmd)');
  const IsWindow = user32.func('bool __stdcall IsWindow(intptr_t hwnd)');
  const IsWindowVisible = user32.func('bool __stdcall IsWindowVisible(intptr_t hwnd)');
  const GetWindowLongPtrW = user32.func('intptr_t __stdcall GetWindowLongPtrW(intptr_t hwnd, int index)');
  const GetClassNameRaw = user32.func('int __stdcall GetClassNameW(intptr_t hwnd, void *buf, int max)');
  const GetForegroundWindow = user32.func('intptr_t __stdcall GetForegroundWindow()');
  const GetWindowRectRaw = user32.func('bool __stdcall GetWindowRect(intptr_t hwnd, _Out_ DF_RECT *rect)');
  const MonitorFromWindow = user32.func('intptr_t __stdcall MonitorFromWindow(intptr_t hwnd, uint32_t flags)');
  const GetMonitorInfoW = user32.func('bool __stdcall GetMonitorInfoW(intptr_t monitor, _Inout_ DF_MONITORINFO *info)');
  const SystemParametersInfoW = user32.func('bool __stdcall SystemParametersInfoW(uint32_t action, uint32_t uiParam, void *pvParam, uint32_t winIni)');
  const SPIGetAnimation = user32.func(
    'bool __stdcall SystemParametersInfoW(uint32_t action, uint32_t uiParam, _Inout_ DF_ANIMATIONINFO *info, uint32_t winIni)',
  );
  const SPIGetBool = user32.func('bool __stdcall SystemParametersInfoW(uint32_t action, uint32_t uiParam, _Out_ int *value, uint32_t winIni)');
  const SPISetPtr = user32.func('bool __stdcall SystemParametersInfoW(uint32_t action, uint32_t uiParam, intptr_t value, uint32_t winIni)');
  const DwmSetWindowAttribute = dwmapi.func('int32_t __stdcall DwmSetWindowAttribute(intptr_t hwnd, uint32_t attr, _In_ uint32_t *value, uint32_t size)');
  const SHAppBarMessage = shell32.func('uintptr_t __stdcall SHAppBarMessage(uint32_t msg, _Inout_ DF_APPBARDATA *data)');
  const SHQueryUserNotificationState = shell32.func('int32_t __stdcall SHQueryUserNotificationState(_Out_ int *state)');

  const SPI_GETANIMATION = 0x0048;
  const SPI_SETANIMATION = 0x0049;
  const SPI_GETCLIENTAREAANIMATION = 0x1042;
  const SPI_SETCLIENTAREAANIMATION = 0x1043;
  const SPIF_UPDATE_AND_SEND = 0x01 | 0x02;
  const ABM_GETSTATE = 0x04;
  const ABM_SETSTATE = 0x0a;
  const ABS_AUTOHIDE = 0x01;
  const ABS_ALWAYSONTOP = 0x02;
  const HWND_BROADCAST = 0xffff;
  const WM_SETTINGCHANGE = 0x001a;
  const SMTO_ABORTIFHUNG = 0x0002;

  const appBar = () => ({ cbSize: koffi.sizeof(APPBARDATA), hWnd: 0, uCallbackMessage: 0, uEdge: 0, rc: { left: 0, top: 0, right: 0, bottom: 0 }, lParam: 0 });

  return {
    FindWindowW,
    FindWindowExW,
    SendMessageTimeoutW,
    SendMessageTimeoutStrW: SendMessageTimeoutStr,
    EnumWindows: (cb, lparam) => EnumWindowsRaw(cb, lparam),
    SetParent,
    SetWindowPos,
    ShowWindow,
    IsWindow,
    IsWindowVisible,
    GetWindowLongPtrW,
    GetClassNameW: (hwnd) => {
      const buf = Buffer.alloc(512);
      const n = GetClassNameRaw(hwnd, buf, 256);
      return n > 0 ? buf.toString('utf16le', 0, n * 2) : '';
    },
    GetForegroundWindow,
    GetWindowRect: (hwnd) => {
      const rect = {};
      return GetWindowRectRaw(hwnd, rect) ? (rect as Rect) : null;
    },
    GetMonitorRectForWindow: (hwnd) => {
      const monitor = MonitorFromWindow(hwnd, 2);
      if (!monitor) return null;
      const info = { cbSize: koffi.sizeof(MONITORINFO), rcMonitor: {}, rcWork: {}, dwFlags: 0 };
      return GetMonitorInfoW(monitor, info) ? (info.rcMonitor as Rect) : null;
    },
    SystemParametersInfoW,
    getAnimation: () => {
      const info = { cbSize: koffi.sizeof(ANIMATIONINFO), iMinAnimate: 0 };
      SPIGetAnimation(SPI_GETANIMATION, koffi.sizeof(ANIMATIONINFO), info, 0);
      return info.iMinAnimate !== 0;
    },
    setAnimation: (on) => {
      const info = { cbSize: koffi.sizeof(ANIMATIONINFO), iMinAnimate: on ? 1 : 0 };
      return SPIGetAnimation(SPI_SETANIMATION, koffi.sizeof(ANIMATIONINFO), info, SPIF_UPDATE_AND_SEND);
    },
    getClientAreaAnimation: () => {
      const out = [0];
      SPIGetBool(SPI_GETCLIENTAREAANIMATION, 0, out, 0);
      return out[0] !== 0;
    },
    setClientAreaAnimation: (on) => SPISetPtr(SPI_SETCLIENTAREAANIMATION, 0, on ? 1 : 0, SPIF_UPDATE_AND_SEND),
    DwmSetWindowAttributeU32: (hwnd, attr, value) => DwmSetWindowAttribute(hwnd, attr, [value >>> 0], 4),
    setAutoHide: (on) => {
      const data = appBar();
      data.lParam = on ? ABS_AUTOHIDE : ABS_ALWAYSONTOP;
      SHAppBarMessage(ABM_SETSTATE, data);
    },
    getAutoHide: () => (Number(SHAppBarMessage(ABM_GETSTATE, appBar())) & ABS_AUTOHIDE) !== 0,
    queryUserNotificationState: () => {
      const out = [0];
      return SHQueryUserNotificationState(out) === 0 ? out[0] : 0;
    },
    broadcastSettingChange: (area) => {
      SendMessageTimeoutStr(HWND_BROADCAST, WM_SETTINGCHANGE, 0, area, SMTO_ABORTIFHUNG, 1000, [0]);
    },
  };
}
