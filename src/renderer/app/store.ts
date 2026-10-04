import { useMemo } from 'react';
import { create } from 'zustand';
import { canRedo, canUndo, createHistory, push, redo, undo, type History } from '../../shared/editor/history';
import type { DesktopStatus, DisplayDescriptor, PlatformCapabilities, Settings, ThemeSummary } from '../../shared/ipc';
import { themeFileUrl } from '../../shared/ipc';
import type { Layer, Theme } from '../../shared/theme/schema';
import { api } from './api';

export type Route = 'library' | 'editor' | 'share' | 'system' | 'performance' | 'settings';
export type InspectorSection = 'layer' | 'colors' | 'windows' | 'taskbar' | 'desktop' | 'performance' | 'info';

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error';
  text: string;
}

interface EditorState {
  history: History<Theme> | null;
  selectedLayerId: string | null;
  section: InspectorSection;
  dirty: boolean;
  saving: boolean;
}

interface StudioState {
  route: Route;
  settings: Settings | null;
  caps: PlatformCapabilities | null;
  displays: DisplayDescriptor[];
  library: ThemeSummary[];
  desktop: DesktopStatus;
  toasts: Toast[];
  editor: EditorState;
  focusThemeId: string | null;

  init(): Promise<void>;
  go(route: Route, focusThemeId?: string | null): void;
  refreshLibrary(): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  toast(kind: Toast['kind'], text: string): void;
  dismissToast(id: number): void;

  openInEditor(theme: Theme): void;
  closeEditor(): void;
  edit(recipe: (draft: Theme) => void, mergeKey?: string): void;
  updateLayer(id: string, patch: Partial<Layer>, mergeKey?: string): void;
  undo(): void;
  redo(): void;
  select(layerId: string | null): void;
  showSection(section: InspectorSection): void;
  saveEditor(): Promise<boolean>;
}

let toastId = 0;

export const useStudio = create<StudioState>((set, get) => ({
  route: 'library',
  settings: null,
  caps: null,
  displays: [],
  library: [],
  desktop: { activeThemeId: null, running: false, paused: false, pauseReason: null, monitorThemes: {} },
  toasts: [],
  editor: { history: null, selectedLayerId: null, section: 'layer', dirty: false, saving: false },
  focusThemeId: null,

  async init() {
    const [settings, caps, displays, desktop] = await Promise.all([
      api.settings.get(),
      api.platform.capabilities(),
      api.platform.displays(),
      api.desktop.status(),
    ]);
    set({ settings, caps, displays, desktop });
    api.themes.onChanged(() => void get().refreshLibrary());
    api.desktop.onStatus((desktop) => set({ desktop }));
    await get().refreshLibrary();
  },

  go(route, focusThemeId) {
    set(focusThemeId !== undefined ? { route, focusThemeId } : { route });
  },

  async refreshLibrary() {
    set({ library: await api.themes.list() });
  },

  async updateSettings(patch) {
    set({ settings: await api.settings.set(patch) });
  },

  toast(kind, text) {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, kind, text }] }));
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 8000 : 4000);
  },

  dismissToast(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  openInEditor(theme) {
    set({
      route: 'editor',
      editor: {
        history: createHistory(theme),
        selectedLayerId: theme.wallpaper.layers[theme.wallpaper.layers.length - 1]?.id ?? null,
        section: 'layer',
        dirty: false,
        saving: false,
      },
    });
  },

  closeEditor() {
    set((s) => ({ editor: { ...s.editor, history: null, selectedLayerId: null, dirty: false } }));
  },

  edit(recipe, mergeKey) {
    const { history } = get().editor;
    if (!history) return;
    const draft: Theme = structuredClone(history.present);
    recipe(draft);
    set((s) => ({ editor: { ...s.editor, history: push(history, draft, mergeKey ?? null), dirty: true } }));
  },

  updateLayer(id, patch, mergeKey) {
    get().edit((t) => {
      const i = t.wallpaper.layers.findIndex((l) => l.id === id);
      if (i >= 0) t.wallpaper.layers[i] = { ...t.wallpaper.layers[i], ...patch } as Layer;
    }, mergeKey);
  },

  undo() {
    const { history } = get().editor;
    if (history && canUndo(history)) set((s) => ({ editor: { ...s.editor, history: undo(history), dirty: true } }));
  },

  redo() {
    const { history } = get().editor;
    if (history && canRedo(history)) set((s) => ({ editor: { ...s.editor, history: redo(history), dirty: true } }));
  },

  select(layerId) {
    set((s) => ({ editor: { ...s.editor, selectedLayerId: layerId, section: layerId ? 'layer' : s.editor.section } }));
  },

  showSection(section) {
    set((s) => ({ editor: { ...s.editor, section } }));
  },

  async saveEditor() {
    const { history } = get().editor;
    if (!history) return false;
    set((s) => ({ editor: { ...s.editor, saving: true } }));
    try {
      await api.themes.save(history.present);
      set((s) => ({ editor: { ...s.editor, dirty: false, saving: false } }));
      return true;
    } catch (err) {
      set((s) => ({ editor: { ...s.editor, saving: false } }));
      get().toast('error', err instanceof Error ? err.message : String(err));
      return false;
    }
  },
}));

export const useEditingTheme = () => useStudio((s) => s.editor.history?.present ?? null);

export function assetResolver(theme: Theme) {
  return (key: string) => {
    const asset = theme.assets[key];
    return asset ? themeFileUrl(theme.id, asset.file) : undefined;
  };
}

export function usePrimaryDisplay() {
  const displays = useStudio((s) => s.displays);
  return useMemo(() => {
    const d = displays.find((x) => x.primary) ?? displays[0];
    return d ? { width: d.width, height: d.height, count: displays.length } : { width: 1920, height: 1080, count: 1 };
  }, [displays]);
}
