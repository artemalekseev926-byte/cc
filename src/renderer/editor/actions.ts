import type { Tool } from '../../shared/editor/tools';
import { themeFileUrl } from '../../shared/ipc';
import { createLayer, createParticlesLayer, createShaderLayer, createImageLayer, createVideoLayer } from '../../shared/theme/factory';
import type { Layer, ParticlePreset, ShaderPreset } from '../../shared/theme/schema';
import { humanizeFileName } from '../../shared/sharing/import';
import { api } from '../app/api';
import type { TFunction } from '../app/i18n';
import { probeMedia } from '../app/media';
import { useStudio } from '../app/store';

const MAX_LAYERS = 16;

function insertLayer(layer: Layer, tr: TFunction): boolean {
  const { edit, select, toast, editor } = useStudio.getState();
  if ((editor.history?.present.wallpaper.layers.length ?? 0) >= MAX_LAYERS) {
    toast('error', tr('editor.layerLimit'));
    return false;
  }
  edit((t) => {
    const isBackground = layer.type === 'image' || layer.type === 'video' || layer.type === 'solid' || layer.type === 'gradient';
    if (isBackground) {
      const firstNonBg = t.wallpaper.layers.findIndex((l) => !['image', 'video', 'solid', 'gradient'].includes(l.type));
      if (firstNonBg >= 0) t.wallpaper.layers.splice(firstNonBg, 0, layer);
      else t.wallpaper.layers.push(layer);
    } else {
      t.wallpaper.layers.push(layer);
    }
  });
  select(layer.id);
  return true;
}

export function addLayerOfType(type: Layer['type'], t: TFunction, preset?: ParticlePreset | ShaderPreset) {
  let layer: Layer;
  if (type === 'particles') layer = createParticlesLayer(preset as ParticlePreset | undefined);
  else if (type === 'shader') layer = createShaderLayer(preset as ShaderPreset | undefined);
  else layer = createLayer(type);
  layer.name = preset ? t(`preset.layer.${preset}`) : t(`layer.type.${type}`);
  if (layer.type === 'shader' || layer.type === 'particles') {
    const accent = useStudio.getState().editor.history?.present.colors.accent;
    if (layer.type === 'shader' && accent) layer.colorB = accent.slice(0, 7);
  }
  insertLayer(layer, t);
}

export async function importMediaFiles(paths: string[], t: TFunction): Promise<void> {
  const state = useStudio.getState();
  const theme = state.editor.history?.present;
  if (!theme) return;
  for (const path of paths) {
    try {
      const { key, asset } = await api.themes.addAsset(theme.id, path);
      const info = await probeMedia(themeFileUrl(theme.id, asset.file), asset.kind);
      const name = humanizeFileName(path.split(/[\\/]/).pop() ?? key);
      useStudio.getState().edit((draft) => {
        draft.assets[key] = { ...asset, ...info };
      });
      insertLayer(asset.kind === 'video' ? createVideoLayer(key, name) : createImageLayer(key, name), t);
      if (asset.kind === 'video' && info.width && info.width > 2560) state.toast('info', t('import.largeVideoHint'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      state.toast('error', `${path.split(/[\\/]/).pop()}: ${t(msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))}`);
    }
  }
}

export async function runTool(tool: Tool, t: TFunction): Promise<void> {
  const { showSection, select } = useStudio.getState();
  const action = tool.action;
  switch (action.kind) {
    case 'addLayer':
      addLayerOfType(action.layer, t, action.preset);
      break;
    case 'importMedia': {
      const paths = await api.themes.pickFiles(action.accept);
      if (paths.length) await importMediaFiles(paths, t);
      break;
    }
    case 'openSection':
      select(null);
      showSection(action.section);
      break;
  }
}
