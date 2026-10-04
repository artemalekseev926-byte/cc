import type { Layer } from '../../shared/theme/schema';
import type { LayerCost } from '../../shared/perf/estimator';
import { newId } from '../../shared/theme/factory';
import { useT } from '../app/i18n';
import { useEditingTheme, useStudio } from '../app/store';
import { Icon, type IconName } from '../components/Icon';

export const LAYER_ICONS: Record<Layer['type'], IconName> = {
  solid: 'square',
  gradient: 'rainbow',
  image: 'image',
  video: 'clapperboard',
  audio: 'music',
  particles: 'snowflake',
  shader: 'wand',
  clock: 'clock',
  text: 'type',
  visualizer: 'audio',
  web: 'globe',
  sysinfo: 'cpu',
};

export function LayerIcon({ type, size = 16 }: { type: Layer['type']; size?: number }) {
  return <Icon name={LAYER_ICONS[type]} size={size} className="layer-icon" />;
}

export function LayerList({ costs }: { costs: LayerCost[] }) {
  const t = useT();
  const theme = useEditingTheme();
  const { editor, select, edit, updateLayer } = useStudio();
  if (!theme) return null;
  const layers = [...theme.wallpaper.layers].reverse();
  const n = theme.wallpaper.layers.length;

  const move = (id: string, dir: 1 | -1) =>
    edit((d) => {
      const i = d.wallpaper.layers.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.wallpaper.layers.length) return;
      [d.wallpaper.layers[i], d.wallpaper.layers[j]] = [d.wallpaper.layers[j], d.wallpaper.layers[i]];
    });

  const remove = (id: string) => {
    edit((d) => {
      d.wallpaper.layers = d.wallpaper.layers.filter((l) => l.id !== id);
    });
    if (editor.selectedLayerId === id) select(null);
  };

  const duplicate = (layer: Layer) => {
    const copy = { ...structuredClone(layer), id: newId(), name: `${layer.name} 2` };
    edit((d) => {
      const i = d.wallpaper.layers.findIndex((l) => l.id === layer.id);
      d.wallpaper.layers.splice(i + 1, 0, copy);
    });
    select(copy.id);
  };

  return (
    <div className="layer-list">
      <div className="panel-title">
        {t('editor.layers')} <span className="muted small">({n}/16)</span>
      </div>
      {layers.length === 0 && <div className="muted small pad">{t('editor.noLayers')}</div>}
      {layers.map((layer) => {
        const cost = costs.find((c) => c.layerId === layer.id);
        const index = theme.wallpaper.layers.indexOf(layer);
        return (
          <div
            key={layer.id}
            className={`layer-row ${editor.selectedLayerId === layer.id ? 'selected' : ''} ${layer.visible ? '' : 'hidden-layer'}`}
            onClick={() => select(layer.id)}
          >
            <button
              type="button"
              className="icon-btn"
              title={layer.visible ? t('editor.hideLayer') : t('editor.showLayer')}
              onClick={(e) => {
                e.stopPropagation();
                updateLayer(layer.id, { visible: !layer.visible });
              }}
            >
              <Icon name={layer.visible ? 'eye' : 'eye-off'} size={15} />
            </button>
            <LayerIcon type={layer.type} />
            <span className="layer-name" title={layer.name}>
              {layer.name}
            </span>
            {cost && layer.visible && (
              <span className="layer-cost muted small" title={t('editor.layerCost')}>
                {cost.cpu + cost.gpu < 0.5 ? '·' : `${Math.round((cost.cpu + cost.gpu) * 10) / 10}%`}
              </span>
            )}
            <span className="layer-buttons">
              <button type="button" className="icon-btn" title={t('editor.moveUp')} disabled={index === n - 1} onClick={(e) => (e.stopPropagation(), move(layer.id, 1))}>
                <Icon name="arrow-up" size={14} />
              </button>
              <button type="button" className="icon-btn" title={t('editor.moveDown')} disabled={index === 0} onClick={(e) => (e.stopPropagation(), move(layer.id, -1))}>
                <Icon name="arrow-down" size={14} />
              </button>
              <button type="button" className="icon-btn" title={t('editor.duplicateLayer')} disabled={n >= 16} onClick={(e) => (e.stopPropagation(), duplicate(layer))}>
                <Icon name="copy" size={14} />
              </button>
              <button type="button" className="icon-btn danger" title={t('editor.deleteLayer')} onClick={(e) => (e.stopPropagation(), remove(layer.id))}>
                <Icon name="trash" size={14} />
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}
