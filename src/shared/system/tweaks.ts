export type TweakId =
  | 'fileExtensions'
  | 'hiddenFiles'
  | 'clockSeconds'
  | 'taskViewButton'
  | 'widgetsButton'
  | 'searchBox'
  | 'classicContextMenu'
  | 'endTask'
  | 'webSearch'
  | 'mouseAcceleration'
  | 'gameMode';

export type TweakValue = boolean | string;

export interface TweakDefinition {
  id: TweakId;
  kind: 'toggle' | 'choice';
  options?: string[];
  icon: string;
  group: 'explorer' | 'taskbar' | 'input' | 'gaming';
  restartExplorer: boolean;
  windows11Only?: boolean;
}

export const TWEAKS: TweakDefinition[] = [
  { id: 'fileExtensions', kind: 'toggle', icon: 'file', group: 'explorer', restartExplorer: false },
  { id: 'hiddenFiles', kind: 'toggle', icon: 'eye', group: 'explorer', restartExplorer: false },
  { id: 'classicContextMenu', kind: 'toggle', icon: 'sliders', group: 'explorer', restartExplorer: true, windows11Only: true },
  { id: 'clockSeconds', kind: 'toggle', icon: 'clock', group: 'taskbar', restartExplorer: false },
  { id: 'searchBox', kind: 'choice', options: ['hidden', 'icon', 'box'], icon: 'search', group: 'taskbar', restartExplorer: false },
  { id: 'taskViewButton', kind: 'toggle', icon: 'layout-grid', group: 'taskbar', restartExplorer: false },
  { id: 'widgetsButton', kind: 'toggle', icon: 'app-window', group: 'taskbar', restartExplorer: false, windows11Only: true },
  { id: 'endTask', kind: 'toggle', icon: 'x', group: 'taskbar', restartExplorer: false, windows11Only: true },
  { id: 'webSearch', kind: 'toggle', icon: 'globe', group: 'taskbar', restartExplorer: true },
  { id: 'mouseAcceleration', kind: 'toggle', icon: 'zap', group: 'input', restartExplorer: false },
  { id: 'gameMode', kind: 'toggle', icon: 'gamepad', group: 'gaming', restartExplorer: false },
];

export const TWEAK_GROUPS: TweakDefinition['group'][] = ['explorer', 'taskbar', 'input', 'gaming'];

export interface TweakState {
  id: TweakId;
  value: TweakValue;
  supported: boolean;
}

export interface SetTweakResult {
  ok: boolean;
  error?: string;
  restartExplorer: boolean;
}

export function isValidTweakValue(id: string, value: unknown): value is TweakValue {
  const def = TWEAKS.find((t) => t.id === id);
  if (!def) return false;
  if (def.kind === 'toggle') return typeof value === 'boolean';
  return typeof value === 'string' && (def.options ?? []).includes(value);
}
