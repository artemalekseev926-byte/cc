import { execFile, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { release } from 'node:os';
import { join } from 'node:path';
import type { BrowserWindow } from 'electron';
import { accentPalette, shade, toAbgr, toArgb, toColorRef } from '../../shared/color';
import type { ApplyResult, ApplyStep, PlatformCapabilities } from '../../shared/ipc';
import type { Theme, WindowsStyle } from '../../shared/theme/schema';
import { win32 } from '../win32/api';
import { KEYS, binary, dword, regDelete, regDeleteKey, regGet, regKeyExists, regSet, regSetDefault, sz, type RegValue } from '../win32/registry';
import { TWEAKS, type SetTweakResult, type TweakId, type TweakState, type TweakValue } from '../../shared/system/tweaks';
import { attachToDesktop, findDesktopListView, hwndFromBuffer, isForegroundFullscreen, isForegroundMaximized } from '../win32/workerw';
import type { ApplyOptions, PlatformAdapter } from './types';

interface Backup {
  createdAt: string;
  registry: Record<string, { type: RegValue['type']; data: number | string } | null>;
  animation: boolean;
  clientAreaAnimation: boolean;
  autoHide: boolean;
  classicMenu?: boolean;
  mouseAcceleration?: boolean;
}

const TOUCHED: Array<[string, string]> = [
  [KEYS.personalize, 'AppsUseLightTheme'],
  [KEYS.personalize, 'SystemUsesLightTheme'],
  [KEYS.personalize, 'EnableTransparency'],
  [KEYS.personalize, 'ColorPrevalence'],
  [KEYS.dwm, 'ColorPrevalence'],
  [KEYS.dwm, 'AccentColor'],
  [KEYS.dwm, 'ColorizationColor'],
  [KEYS.dwm, 'ColorizationAfterglow'],
  [KEYS.accent, 'AccentColorMenu'],
  [KEYS.accent, 'StartColorMenu'],
  [KEYS.accent, 'AccentPalette'],
  [KEYS.advanced, 'TaskbarAl'],
  [KEYS.advanced, 'TaskbarSi'],
  [KEYS.advanced, 'TaskbarSmallIcons'],
  [KEYS.advanced, 'HideIcons'],
  [KEYS.stuckRects3, 'Settings'],
  [KEYS.desktopBag, 'IconSize'],
  [KEYS.controlDesktop, 'AutoColorization'],
  [KEYS.advanced, 'HideFileExt'],
  [KEYS.advanced, 'Hidden'],
  [KEYS.advanced, 'ShowSecondsInSystemClock'],
  [KEYS.advanced, 'ShowTaskViewButton'],
  [KEYS.advanced, 'TaskbarDa'],
  [KEYS.search, 'SearchboxTaskbarMode'],
  [KEYS.taskbarDev, 'TaskbarEndTask'],
  [KEYS.explorerPolicy, 'DisableSearchBoxSuggestions'],
  [KEYS.gameBar, 'AutoGameModeEnabled'],
  [KEYS.mouse, 'MouseSpeed'],
  [KEYS.mouse, 'MouseThreshold1'],
  [KEYS.mouse, 'MouseThreshold2'],
];

const DWMWA_WINDOW_CORNER_PREFERENCE = 33;
const DWMWA_BORDER_COLOR = 34;
const DWMWA_CAPTION_COLOR = 35;
const DWMWA_TEXT_COLOR = 36;
const DWMWA_COLOR_DEFAULT = 0xffffffff;
const GWL_STYLE = -16;
const GWL_EXSTYLE = -20;
const WS_CAPTION = 0x00c00000;
const WS_EX_TOOLWINDOW = 0x00000080;

const EDGE: Record<Theme['taskbar']['position'], number> = { left: 0, top: 1, right: 2, bottom: 3 };
const ICON_SIZE: Record<Theme['desktop']['iconSize'], number> = { small: 32, medium: 48, large: 96 };

export class WindowsPlatform implements PlatformAdapter {
  private readonly build = Number(release().split('.')[2] ?? 0);
  private readonly isWin11 = this.build >= 22000;
  private shellRestartListeners: Array<() => void> = [];
  private styleTimer: NodeJS.Timeout | null = null;
  private styledWindows = new Map<number, string>();
  private currentStyle: WindowsStyle | null = null;

  constructor(private readonly userDataDir: string) {}

  capabilities(): PlatformCapabilities {
    const ok = win32() !== null;
    return {
      os: 'windows',
      osVersion: `${this.isWin11 ? 'Windows 11' : 'Windows 10'} (build ${this.build})`,
      isWindows11: this.isWin11,
      liveWallpaper: ok,
      accentColor: true,
      darkMode: true,
      transparency: true,
      accentOnTaskbar: true,
      accentOnTitleBars: true,
      windowAnimations: ok,
      windowCorners: ok && this.isWin11,
      windowColors: ok && this.isWin11,
      taskbarPositions: this.isWin11 ? ['bottom', 'top'] : ['bottom', 'top', 'left', 'right'],
      taskbarAlignment: this.isWin11,
      taskbarAutoHide: ok,
      taskbarSize: true,
      desktopIcons: ok,
    };
  }

  private get backupPath() {
    return join(this.userDataDir, 'windows-backup.json');
  }

  private async ensureBackup(): Promise<void> {
    const api = win32();
    let backup: Backup;
    let changed = false;
    try {
      backup = JSON.parse(await fs.readFile(this.backupPath, 'utf8'));
    } catch {
      backup = {
        createdAt: new Date().toISOString(),
        registry: {},
        animation: api?.getAnimation() ?? true,
        clientAreaAnimation: api?.getClientAreaAnimation() ?? true,
        autoHide: api?.getAutoHide() ?? false,
      };
      changed = true;
    }
    for (const [key, name] of TOUCHED) {
      const id = `${key}|${name}`;
      if (id in backup.registry) continue;
      const value = await regGet(key, name);
      backup.registry[id] = value
        ? { type: value.type, data: value.type === 'REG_BINARY' ? value.data.toString('hex') : (value.data as number | string) }
        : null;
      changed = true;
    }
    if (backup.classicMenu === undefined) {
      backup.classicMenu = await regKeyExists(`${KEYS.classicMenu}\\InprocServer32`);
      changed = true;
    }
    if (backup.mouseAcceleration === undefined && api) {
      backup.mouseAcceleration = api.getMouseAcceleration();
      changed = true;
    }
    if (changed) await fs.writeFile(this.backupPath, JSON.stringify(backup, null, 2), 'utf8');
  }

  async tweaks(): Promise<TweakState[]> {
    const api = win32();
    const num = async (key: string, name: string, fallback: number) => {
      const v = await regGet(key, name);
      return v && v.type === 'REG_DWORD' ? v.data : fallback;
    };
    const values: Record<TweakId, TweakValue> = {
      fileExtensions: (await num(KEYS.advanced, 'HideFileExt', 1)) === 0,
      hiddenFiles: (await num(KEYS.advanced, 'Hidden', 2)) === 1,
      classicContextMenu: await regKeyExists(`${KEYS.classicMenu}\\InprocServer32`),
      clockSeconds: (await num(KEYS.advanced, 'ShowSecondsInSystemClock', 0)) === 1,
      searchBox: ['hidden', 'icon', 'box', 'box'][Math.min(3, await num(KEYS.search, 'SearchboxTaskbarMode', 1))],
      taskViewButton: (await num(KEYS.advanced, 'ShowTaskViewButton', 1)) === 1,
      widgetsButton: (await num(KEYS.advanced, 'TaskbarDa', 1)) === 1,
      endTask: (await num(KEYS.taskbarDev, 'TaskbarEndTask', 0)) === 1,
      webSearch: (await num(KEYS.explorerPolicy, 'DisableSearchBoxSuggestions', 0)) === 0,
      mouseAcceleration: api?.getMouseAcceleration() ?? true,
      gameMode: (await num(KEYS.gameBar, 'AutoGameModeEnabled', 1)) === 1,
    };
    return TWEAKS.map((t) => ({ id: t.id, value: values[t.id], supported: !t.windows11Only || this.isWin11 }));
  }

  async setTweak(id: TweakId, value: TweakValue): Promise<SetTweakResult> {
    const def = TWEAKS.find((t) => t.id === id);
    if (!def) return { ok: false, error: 'unknown', restartExplorer: false };
    if (def.windows11Only && !this.isWin11) return { ok: false, error: 'apply.needsWin11', restartExplorer: false };
    await this.ensureBackup();
    const api = win32();
    const on = value === true;
    try {
      switch (id) {
        case 'fileExtensions':
          await regSet(KEYS.advanced, 'HideFileExt', dword(on ? 0 : 1));
          break;
        case 'hiddenFiles':
          await regSet(KEYS.advanced, 'Hidden', dword(on ? 1 : 2));
          break;
        case 'classicContextMenu':
          if (on) await regSetDefault(`${KEYS.classicMenu}\\InprocServer32`, '');
          else await regDeleteKey(KEYS.classicMenu);
          break;
        case 'clockSeconds':
          await regSet(KEYS.advanced, 'ShowSecondsInSystemClock', dword(on ? 1 : 0));
          break;
        case 'searchBox':
          await regSet(KEYS.search, 'SearchboxTaskbarMode', dword(({ hidden: 0, icon: 1, box: 2 } as Record<string, number>)[String(value)] ?? 1));
          break;
        case 'taskViewButton':
          await regSet(KEYS.advanced, 'ShowTaskViewButton', dword(on ? 1 : 0));
          break;
        case 'widgetsButton':
          await regSet(KEYS.advanced, 'TaskbarDa', dword(on ? 1 : 0));
          break;
        case 'endTask':
          await regSet(KEYS.taskbarDev, 'TaskbarEndTask', dword(on ? 1 : 0));
          break;
        case 'webSearch':
          await regSet(KEYS.explorerPolicy, 'DisableSearchBoxSuggestions', dword(on ? 0 : 1));
          break;
        case 'mouseAcceleration':
          await regSet(KEYS.mouse, 'MouseSpeed', sz(on ? '1' : '0'));
          await regSet(KEYS.mouse, 'MouseThreshold1', sz(on ? '6' : '0'));
          await regSet(KEYS.mouse, 'MouseThreshold2', sz(on ? '10' : '0'));
          api?.setMouseAcceleration(on);
          break;
        case 'gameMode':
          await regSet(KEYS.gameBar, 'AutoGameModeEnabled', dword(on ? 1 : 0));
          break;
      }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err), restartExplorer: false };
    }
    api?.broadcastSettingChange('TraySettings');
    api?.broadcastSettingChange('Policy');
    api?.refreshShell();
    return { ok: true, restartExplorer: def.restartExplorer };
  }

  async applySystemTheme(theme: Theme, options: ApplyOptions): Promise<ApplyResult> {
    await this.ensureBackup();
    const steps: ApplyStep[] = [];
    const caps = this.capabilities();
    const api = win32();
    let needsExplorerRestart = false;

    const step = async (what: string, fn: () => Promise<void> | void, supported = true, reason = 'apply.unsupported') => {
      if (!supported) {
        steps.push({ what, status: 'skipped', reason });
        return;
      }
      try {
        await fn();
        steps.push({ what, status: 'applied' });
      } catch (err) {
        steps.push({ what, status: 'failed', reason: err instanceof Error ? err.message : String(err) });
      }
    };

    const { colors, windows, taskbar, desktop } = theme;

    await step('apply.darkMode', async () => {
      const light = colors.mode === 'light' ? 1 : 0;
      await regSet(KEYS.personalize, 'AppsUseLightTheme', dword(light));
      await regSet(KEYS.personalize, 'SystemUsesLightTheme', dword(light));
    });

    await step('apply.transparency', () => regSet(KEYS.personalize, 'EnableTransparency', dword(colors.transparency ? 1 : 0)));

    await step('apply.accent', async () => {
      const accent = colors.accent.slice(0, 7);
      await regSet(KEYS.dwm, 'AccentColor', dword(toAbgr(accent)));
      await regSet(KEYS.dwm, 'ColorizationColor', dword(toArgb(accent)));
      await regSet(KEYS.dwm, 'ColorizationAfterglow', dword(toArgb(accent)));
      await regSet(KEYS.accent, 'AccentColorMenu', dword(toAbgr(accent)));
      await regSet(KEYS.accent, 'StartColorMenu', dword(toAbgr(shade(accent, -0.25))));
      await regSet(KEYS.accent, 'AccentPalette', binary(Buffer.from(accentPalette(accent))));
      await regSet(KEYS.controlDesktop, 'AutoColorization', dword(0));
    });

    await step('apply.accentOnTaskbar', () => regSet(KEYS.personalize, 'ColorPrevalence', dword(colors.accentOnTaskbar ? 1 : 0)));
    await step('apply.accentOnTitleBars', () => regSet(KEYS.dwm, 'ColorPrevalence', dword(colors.accentOnTitleBars ? 1 : 0)));

    await step(
      'apply.windowAnimations',
      () => {
        api!.setAnimation(windows.animations);
        api!.setClientAreaAnimation(windows.animations);
      },
      caps.windowAnimations,
    );

    await step('apply.windowStyle', () => this.startWindowStyler(windows), caps.windowCorners, 'apply.needsWin11');

    await step(
      'apply.taskbarAlignment',
      () => regSet(KEYS.advanced, 'TaskbarAl', dword(taskbar.alignment === 'center' ? 1 : 0)),
      caps.taskbarAlignment,
      'apply.needsWin11',
    );

    await step('apply.taskbarSize', async () => {
      const small = taskbar.size === 'small';
      if (this.isWin11) await regSet(KEYS.advanced, 'TaskbarSi', dword(small ? 0 : 1));
      else await regSet(KEYS.advanced, 'TaskbarSmallIcons', dword(small ? 1 : 0));
    });

    await step('apply.taskbarAutoHide', () => api!.setAutoHide(taskbar.autoHide), caps.taskbarAutoHide);

    await step(
      'apply.taskbarPosition',
      async () => {
        const current = await regGet(KEYS.stuckRects3, 'Settings');
        if (!current || current.type !== 'REG_BINARY' || current.data.length < 13) throw new Error('StuckRects3 not found');
        const data = Buffer.from(current.data);
        const edge = EDGE[taskbar.position];
        if (data[12] !== edge) {
          data[12] = edge;
          data[8] = taskbar.autoHide ? 0x03 : 0x02;
          await regSet(KEYS.stuckRects3, 'Settings', binary(data));
          needsExplorerRestart = true;
        }
      },
      caps.taskbarPositions.includes(taskbar.position),
      'apply.positionUnsupported',
    );

    await step(
      'apply.desktopIcons',
      async () => {
        await regSet(KEYS.advanced, 'HideIcons', dword(desktop.showIcons ? 0 : 1));
        const listView = findDesktopListView();
        if (listView) api!.ShowWindow(listView, desktop.showIcons ? 5 : 0);
        const size = await regGet(KEYS.desktopBag, 'IconSize');
        const wanted = ICON_SIZE[desktop.iconSize];
        if (!size || size.data !== wanted) {
          await regSet(KEYS.desktopBag, 'IconSize', dword(wanted));
          needsExplorerRestart = true;
        }
      },
      caps.desktopIcons,
    );

    api?.broadcastSettingChange('ImmersiveColorSet');
    api?.broadcastSettingChange('TraySettings');
    api?.broadcastSettingChange('WindowsThemeElement');

    let explorerRestarted = false;
    if (needsExplorerRestart) {
      if (options.allowExplorerRestart) {
        await this.restartExplorer();
        explorerRestarted = true;
      } else {
        steps.push({ what: 'apply.explorerRestart', status: 'skipped', reason: 'apply.restartDisabled' });
      }
    }

    return { ok: steps.every((s) => s.status !== 'failed'), steps, explorerRestarted };
  }

  async restoreOriginal(): Promise<ApplyResult> {
    const steps: ApplyStep[] = [];
    this.stopWindowStyler(true);
    let backup: Backup;
    try {
      backup = JSON.parse(await fs.readFile(this.backupPath, 'utf8'));
    } catch {
      return { ok: true, steps: [{ what: 'apply.restore', status: 'skipped', reason: 'apply.nothingToRestore' }], explorerRestarted: false };
    }
    let needsRestart = false;
    for (const [id, value] of Object.entries(backup.registry)) {
      const [key, name] = id.split('|');
      try {
        if (value === null) await regDelete(key, name);
        else if (value.type === 'REG_BINARY') await regSet(key, name, binary(Buffer.from(String(value.data), 'hex')));
        else if (value.type === 'REG_DWORD') await regSet(key, name, dword(Number(value.data)));
        else await regSet(key, name, { type: 'REG_SZ', data: String(value.data) });
        if (key === KEYS.stuckRects3 || key === KEYS.desktopBag) needsRestart = true;
      } catch (err) {
        steps.push({ what: `${key}\\${name}`, status: 'failed', reason: String(err) });
      }
    }
    const api = win32();
    if (api) {
      api.setAnimation(backup.animation);
      api.setClientAreaAnimation(backup.clientAreaAnimation);
      api.setAutoHide(backup.autoHide);
      const listView = findDesktopListView();
      const hidden = backup.registry[`${KEYS.advanced}|HideIcons`];
      if (listView) api.ShowWindow(listView, hidden && Number(hidden.data) === 1 ? 0 : 5);
      api.broadcastSettingChange('ImmersiveColorSet');
      api.broadcastSettingChange('TraySettings');
    }
    if (api && backup.mouseAcceleration !== undefined) api.setMouseAcceleration(backup.mouseAcceleration);
    if (backup.classicMenu === false && (await regKeyExists(`${KEYS.classicMenu}\\InprocServer32`))) {
      await regDeleteKey(KEYS.classicMenu);
      needsRestart = true;
    }
    api?.refreshShell();
    if (needsRestart) await this.restartExplorer();
    await fs.rm(this.backupPath, { force: true });
    steps.push({ what: 'apply.restore', status: 'applied' });
    return { ok: steps.every((s) => s.status !== 'failed'), steps, explorerRestarted: needsRestart };
  }

  private startWindowStyler(style: WindowsStyle): void {
    this.currentStyle = style;
    this.styledWindows.clear();
    const isDefault = style.corners === 'default' && !style.borderColor && !style.captionColor && !style.captionTextColor;
    if (isDefault) {
      this.stopWindowStyler(true);
      return;
    }
    this.styleAllWindows();
    if (!this.styleTimer) this.styleTimer = setInterval(() => this.styleAllWindows(), 1500);
  }

  private stopWindowStyler(resetToDefault: boolean): void {
    if (this.styleTimer) clearInterval(this.styleTimer);
    this.styleTimer = null;
    if (resetToDefault && this.styledWindows.size > 0) {
      const api = win32();
      for (const hwnd of this.styledWindows.keys()) {
        if (!api?.IsWindow(hwnd)) continue;
        api.DwmSetWindowAttributeU32(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, 0);
        api.DwmSetWindowAttributeU32(hwnd, DWMWA_BORDER_COLOR, DWMWA_COLOR_DEFAULT);
        api.DwmSetWindowAttributeU32(hwnd, DWMWA_CAPTION_COLOR, DWMWA_COLOR_DEFAULT);
        api.DwmSetWindowAttributeU32(hwnd, DWMWA_TEXT_COLOR, DWMWA_COLOR_DEFAULT);
      }
    }
    this.styledWindows.clear();
  }

  private styleAllWindows(): void {
    const api = win32();
    const style = this.currentStyle;
    if (!api || !style) return;
    const key = JSON.stringify(style);
    const corner = { default: 0, square: 1, round: 2, 'round-small': 3 }[style.corners];
    const seen = new Set<number>();
    api.EnumWindows((hwnd) => {
      seen.add(hwnd);
      if (this.styledWindows.get(hwnd) === key) return true;
      if (!api.IsWindowVisible(hwnd)) return true;
      const ws = Number(api.GetWindowLongPtrW(hwnd, GWL_STYLE));
      const ex = Number(api.GetWindowLongPtrW(hwnd, GWL_EXSTYLE));
      if ((ws & WS_CAPTION) !== WS_CAPTION || (ex & WS_EX_TOOLWINDOW) !== 0) return true;
      api.DwmSetWindowAttributeU32(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, corner);
      api.DwmSetWindowAttributeU32(hwnd, DWMWA_BORDER_COLOR, style.borderColor ? toColorRef(style.borderColor.slice(0, 7)) : DWMWA_COLOR_DEFAULT);
      api.DwmSetWindowAttributeU32(hwnd, DWMWA_CAPTION_COLOR, style.captionColor ? toColorRef(style.captionColor.slice(0, 7)) : DWMWA_COLOR_DEFAULT);
      api.DwmSetWindowAttributeU32(
        hwnd,
        DWMWA_TEXT_COLOR,
        style.captionTextColor ? toColorRef(style.captionTextColor.slice(0, 7)) : DWMWA_COLOR_DEFAULT,
      );
      this.styledWindows.set(hwnd, key);
      return true;
    }, 0);
    for (const hwnd of this.styledWindows.keys()) if (!seen.has(hwnd)) this.styledWindows.delete(hwnd);
  }

  attachWallpaperWindow(win: BrowserWindow, bounds: { x: number; y: number; width: number; height: number }): boolean {
    return attachToDesktop(hwndFromBuffer(win.getNativeWindowHandle()), bounds);
  }

  isForegroundFullscreen(): boolean {
    return isForegroundFullscreen();
  }

  isForegroundMaximized(): boolean {
    return isForegroundMaximized();
  }

  onShellRestart(cb: () => void): void {
    this.shellRestartListeners.push(cb);
  }

  async restartExplorer(): Promise<void> {
    await new Promise<void>((resolve) => execFile('taskkill.exe', ['/f', '/im', 'explorer.exe'], { windowsHide: true }, () => resolve()));
    await new Promise((r) => setTimeout(r, 800));
    spawn('explorer.exe', [], { detached: true, stdio: 'ignore' }).unref();
    await new Promise((r) => setTimeout(r, 3500));
    for (const cb of this.shellRestartListeners) cb();
  }

  dispose(): void {
    this.stopWindowStyler(true);
  }
}
