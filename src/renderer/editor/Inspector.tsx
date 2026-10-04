import { useState, type ReactNode } from 'react';
import type { Estimate } from '../../shared/perf/estimator';
import type {
  AudioLayer,
  BlendMode,
  ClockLayer,
  Fit,
  GradientLayer,
  ImageLayer,
  Layer,
  ParticlePreset,
  ParticlesLayer,
  ShaderLayer,
  ShaderPreset,
  SysInfoLayer,
  TextLayer,
  Theme,
  VideoLayer,
  VisualizerLayer,
  WebLayer,
  WidgetPosition,
} from '../../shared/theme/schema';
import { THEME_TAGS } from '../../shared/sharing/validate';
import { isHttpsUrl } from '../../shared/theme/schema';
import { useT, type TFunction } from '../app/i18n';
import { extractAccent } from '../app/media';
import { useEditingTheme, useStudio, type InspectorSection } from '../app/store';
import { RatingBadge } from '../components/PerfMeter';
import { Button, ColorField, Field, Segmented, Slider, Tip, Toggle } from '../components/ui';
import { LayerIcon } from './LayerList';
import { Icon, type IconName } from '../components/Icon';

const SECTIONS: Array<{ id: InspectorSection; icon: IconName }> = [
  { id: 'layer', icon: 'layers' },
  { id: 'colors', icon: 'palette' },
  { id: 'windows', icon: 'app-window' },
  { id: 'taskbar', icon: 'panel-bottom' },
  { id: 'desktop', icon: 'layout-grid' },
  { id: 'performance', icon: 'gauge' },
  { id: 'info', icon: 'info' },
];

function SectionTitle({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <h3 className="with-icon">
      <Icon name={icon} size={17} /> {children}
    </h3>
  );
}

export function Inspector({ estimate }: { estimate: Estimate }) {
  const t = useT();
  const theme = useEditingTheme();
  const { editor, showSection } = useStudio();
  if (!theme) return null;
  const layer = theme.wallpaper.layers.find((l) => l.id === editor.selectedLayerId) ?? null;

  return (
    <aside className="panel inspector">
      <nav className="inspector-tabs">
        {SECTIONS.map((s) => (
          <button
            type="button"
            key={s.id}
            className={editor.section === s.id ? 'active' : ''}
            onClick={() => showSection(s.id)}
            title={t(`section.${s.id}`)}
          >
            <Icon name={s.icon} size={17} />
            <span className="tab-label">{t(`section.${s.id}`)}</span>
          </button>
        ))}
      </nav>
      <div className="inspector-body">
        {editor.section === 'layer' &&
          (layer ? <LayerInspector layer={layer} theme={theme} /> : <div className="muted pad">{t('editor.selectLayer')}</div>)}
        {editor.section === 'colors' && <ColorsSection theme={theme} />}
        {editor.section === 'windows' && <WindowsSection theme={theme} />}
        {editor.section === 'taskbar' && <TaskbarSection theme={theme} />}
        {editor.section === 'desktop' && <DesktopSection theme={theme} />}
        {editor.section === 'performance' && <PerformanceSection theme={theme} estimate={estimate} />}
        {editor.section === 'info' && <InfoSection theme={theme} />}
      </div>
    </aside>
  );
}

function Advanced({ children }: { children: ReactNode }) {
  const t = useT();
  const beginner = useStudio((s) => s.settings?.beginnerMode ?? true);
  const [open, setOpen] = useState(!beginner);
  if (!beginner) return <>{children}</>;
  return (
    <div className="advanced">
      <button type="button" className="advanced-toggle" onClick={() => setOpen(!open)}>
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={14} /> {t('editor.moreOptions')}
      </button>
      {open && children}
    </div>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function LayerInspector({ layer, theme }: { layer: Layer; theme: Theme }) {
  const t = useT();
  const updateLayer = useStudio((s) => s.updateLayer);
  const set = <L extends Layer>(patch: Partial<L>, key?: string) => updateLayer(layer.id, patch as Partial<Layer>, key ? `${layer.id}:${key}` : undefined);

  return (
    <div className="stack">
      <div className="inspector-heading">
        <LayerIcon type={layer.type} size={24} />
        <input className="name-input" value={layer.name} maxLength={60} onChange={(e) => set({ name: e.target.value || ' ' }, 'name')} />
      </div>
      <p className="muted small">{t(`layer.help.${layer.type}`)}</p>

      {layer.type === 'solid' && (
        <Field label={t('prop.color')}>
          <ColorField value={layer.color} onChange={(v) => v && set({ color: v }, 'color')} />
        </Field>
      )}
      {layer.type === 'gradient' && <GradientProps layer={layer} set={set} />}
      {layer.type === 'image' && <ImageProps layer={layer} theme={theme} set={set} />}
      {layer.type === 'video' && <VideoProps layer={layer} theme={theme} set={set} />}
      {layer.type === 'audio' && <AudioProps layer={layer} theme={theme} set={set} />}
      {layer.type === 'particles' && <ParticleProps layer={layer} set={set} />}
      {layer.type === 'shader' && <ShaderProps layer={layer} set={set} />}
      {layer.type === 'clock' && <ClockProps layer={layer} set={set} />}
      {layer.type === 'text' && <TextProps layer={layer} set={set} />}
      {layer.type === 'visualizer' && <VisualizerProps layer={layer} set={set} />}
      {layer.type === 'web' && <WebProps layer={layer} set={set} />}
      {layer.type === 'sysinfo' && <SysInfoProps layer={layer} set={set} />}

      {layer.type !== 'audio' && (
        <>
          <Field label={t('prop.opacity')} hint={t('prop.opacityHint')}>
            <Slider value={layer.opacity} min={0} max={1} step={0.01} format={pct} onChange={(v) => set({ opacity: v }, 'opacity')} />
          </Field>
          <Advanced>
            <Field label={t('prop.blend')} hint={t('prop.blendHint')}>
              <select value={layer.blendMode} onChange={(e) => set({ blendMode: e.target.value as BlendMode })}>
                {(['normal', 'screen', 'multiply', 'overlay', 'lighten', 'darken', 'soft-light'] as BlendMode[]).map((m) => (
                  <option key={m} value={m}>
                    {t(`blend.${m}`)}
                  </option>
                ))}
              </select>
            </Field>
          </Advanced>
        </>
      )}
    </div>
  );
}

type Setter<L> = (patch: Partial<L>, key?: string) => void;

function GradientProps({ layer, set }: { layer: GradientLayer; set: Setter<GradientLayer> }) {
  const t = useT();
  return (
    <>
      <Field label={t('prop.colors')} hint={t('prop.gradientColorsHint')}>
        <div className="stack-sm">
          {layer.colors.map((c, i) => (
            <div key={i} className="row">
              <input type="color" value={c.slice(0, 7)} onChange={(e) => set({ colors: layer.colors.map((x, j) => (j === i ? e.target.value : x)) }, `color${i}`)} />
              <code className="small">{c}</code>
              {layer.colors.length > 2 && (
                <button type="button" className="icon-btn" onClick={() => set({ colors: layer.colors.filter((_, j) => j !== i) })} title={t('common.remove')}>
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>
          ))}
          {layer.colors.length < 6 && (
            <Button size="sm" icon="plus" onClick={() => set({ colors: [...layer.colors, layer.colors[layer.colors.length - 1]] })}>
              {t('prop.addColor')}
            </Button>
          )}
        </div>
      </Field>
      <Field label={t('prop.angle')}>
        <Slider value={layer.angle} min={0} max={360} format={(v) => `${v}°`} onChange={(v) => set({ angle: v }, 'angle')} />
      </Field>
      <Field label={t('prop.animated')} hint={t('prop.animatedHint')}>
        <Toggle checked={layer.animated} onChange={(v) => set({ animated: v })} />
      </Field>
      {layer.animated && (
        <Field label={t('prop.cycle')}>
          <Slider value={layer.cycleSeconds} min={2} max={120} format={(v) => t('unit.seconds', { n: v })} marks={[t('mark.fast'), t('mark.slow')]} onChange={(v) => set({ cycleSeconds: v }, 'cycle')} />
        </Field>
      )}
    </>
  );
}

function FitField<L extends ImageLayer | VideoLayer>({ layer, set }: { layer: L; set: Setter<L> }) {
  const t = useT();
  return (
    <Field label={t('prop.fit')} hint={t('prop.fitHint')}>
      <Segmented<Fit>
        value={layer.fit}
        onChange={(v) => set({ fit: v } as Partial<L>)}
        options={(['cover', 'contain', 'fill', 'center'] as Fit[]).map((f) => ({ value: f, label: t(`fit.${f}`) }))}
      />
    </Field>
  );
}

function AssetInfo({ theme, assetKey }: { theme: Theme; assetKey: string }) {
  const t = useT();
  const a = theme.assets[assetKey];
  if (!a)
    return (
      <div className="field-note">
        <Icon name="warning" size={12} /> {t('prop.assetMissing')}
      </div>
    );
  const parts = [a.width && a.height ? `${a.width}×${a.height}` : null, a.fps ? `${a.fps} FPS` : null, a.durationSec ? t('unit.seconds', { n: Math.round(a.durationSec) }) : null, `${(a.bytes / 1024 / 1024).toFixed(1)} MB`];
  return <div className="asset-info small muted">
      <Icon name="file" size={12} /> {a.file.split('/').pop()} · {parts.filter(Boolean).join(' · ')}</div>;
}

function ImageProps({ layer, theme, set }: { layer: ImageLayer; theme: Theme; set: Setter<ImageLayer> }) {
  const t = useT();
  return (
    <>
      <AssetInfo theme={theme} assetKey={layer.asset} />
      <FitField layer={layer} set={set} />
      <Field label={t('prop.parallax')} hint={t('prop.parallaxHint')}>
        <Slider value={layer.parallax} min={0} max={1} step={0.05} format={(v) => (v === 0 ? t('common.off') : pct(v))} onChange={(v) => set({ parallax: v }, 'parallax')} />
      </Field>
      <Field label={t('prop.slowZoom')} hint={t('prop.slowZoomHint')}>
        <Toggle checked={layer.slowZoom} onChange={(v) => set({ slowZoom: v })} />
      </Field>
      <Field label={t('prop.blur')} hint={t('prop.blurHint')}>
        <Slider value={layer.blur} min={0} max={40} format={(v) => (v === 0 ? t('common.off') : `${v}px`)} onChange={(v) => set({ blur: v }, 'blur')} />
      </Field>
      <Field label={t('prop.beatPulse')} hint={t('prop.beatPulseHint')}>
        <Slider value={layer.beatPulse} min={0} max={1} step={0.05} format={(v) => (v === 0 ? t('common.off') : pct(v))} onChange={(v) => set({ beatPulse: v }, 'beatPulse')} />
      </Field>
    </>
  );
}

function VideoProps({ layer, theme, set }: { layer: VideoLayer; theme: Theme; set: Setter<VideoLayer> }) {
  const t = useT();
  return (
    <>
      <AssetInfo theme={theme} assetKey={layer.asset} />
      <FitField layer={layer} set={set} />
      <Field label={t('prop.playbackRate')}>
        <Slider value={layer.playbackRate} min={0.25} max={2} step={0.05} format={(v) => `${v.toFixed(2)}×`} marks={[t('mark.slow'), t('mark.fast')]} onChange={(v) => set({ playbackRate: v }, 'rate')} />
      </Field>
      <Field label={t('prop.videoSound')} hint={t('prop.videoSoundHint')}>
        <Toggle checked={layer.sound} onChange={(v) => set({ sound: v })} />
      </Field>
      {layer.sound && (
        <Field label={t('prop.volume')}>
          <Slider value={layer.volume} min={0} max={1} step={0.01} format={pct} onChange={(v) => set({ volume: v }, 'volume')} />
        </Field>
      )}
    </>
  );
}

function AudioProps({ layer, theme, set }: { layer: AudioLayer; theme: Theme; set: Setter<AudioLayer> }) {
  const t = useT();
  return (
    <>
      <AssetInfo theme={theme} assetKey={layer.asset} />
      <Field label={t('prop.volume')} hint={t('prop.volumeHint')}>
        <Slider value={layer.volume} min={0} max={1} step={0.01} format={pct} onChange={(v) => set({ volume: v }, 'volume')} />
      </Field>
      <Field label={t('prop.fadeIn')} hint={t('prop.fadeInHint')}>
        <Slider value={layer.fadeInSeconds} min={0} max={10} step={0.5} format={(v) => (v === 0 ? t('common.off') : t('unit.seconds', { n: v }))} onChange={(v) => set({ fadeInSeconds: v }, 'fade')} />
      </Field>
      <Tip>{t('prop.audioTip')}</Tip>
    </>
  );
}

function ParticleProps({ layer, set }: { layer: ParticlesLayer; set: Setter<ParticlesLayer> }) {
  const t = useT();
  return (
    <>
      <Field label={t('prop.effect')}>
        <select value={layer.preset} onChange={(e) => set({ preset: e.target.value as ParticlePreset })}>
          {(['snow', 'rain', 'fireflies', 'stars', 'bubbles', 'sakura'] as ParticlePreset[]).map((p) => (
            <option key={p} value={p}>
              {t(`preset.layer.${p}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('prop.count')} hint={t('prop.countHint')}>
        <Slider value={layer.count} min={10} max={3000} step={10} marks={[t('mark.few'), t('mark.many')]} onChange={(v) => set({ count: v }, 'count')} />
      </Field>
      <Field label={t('prop.speed')}>
        <Slider value={layer.speed} min={0.1} max={5} step={0.1} format={(v) => `${v.toFixed(1)}×`} marks={[t('mark.calm'), t('mark.wild')]} onChange={(v) => set({ speed: v }, 'speed')} />
      </Field>
      <Field label={t('prop.size')}>
        <Slider value={layer.size} min={0.5} max={6} step={0.1} format={(v) => `${v.toFixed(1)}×`} onChange={(v) => set({ size: v }, 'size')} />
      </Field>
      <Field label={t('prop.color')}>
        <ColorField value={layer.color} onChange={(v) => v && set({ color: v }, 'color')} />
      </Field>
      <Field label={t('prop.interactive')} hint={t('prop.interactiveHint')}>
        <Toggle checked={layer.interactive} onChange={(v) => set({ interactive: v })} />
      </Field>
    </>
  );
}

function ShaderProps({ layer, set }: { layer: ShaderLayer; set: Setter<ShaderLayer> }) {
  const t = useT();
  return (
    <>
      <Field label={t('prop.effect')}>
        <select value={layer.preset} onChange={(e) => set({ preset: e.target.value as ShaderPreset })}>
          {(['aurora', 'waves', 'plasma', 'nebula', 'grid'] as ShaderPreset[]).map((p) => (
            <option key={p} value={p}>
              {t(`preset.layer.${p}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('prop.colorA')}>
        <ColorField value={layer.colorA} onChange={(v) => v && set({ colorA: v }, 'colorA')} />
      </Field>
      <Field label={t('prop.colorB')}>
        <ColorField value={layer.colorB} onChange={(v) => v && set({ colorB: v }, 'colorB')} />
      </Field>
      <Field label={t('prop.speed')}>
        <Slider value={layer.speed} min={0.1} max={4} step={0.1} format={(v) => `${v.toFixed(1)}×`} marks={[t('mark.calm'), t('mark.wild')]} onChange={(v) => set({ speed: v }, 'speed')} />
      </Field>
      <Advanced>
        <Field label={t('prop.quality')} hint={t('prop.qualityHint')}>
          <Slider value={layer.quality} min={0.25} max={1} step={0.05} format={pct} marks={[t('mark.fastPc'), t('mark.sharp')]} onChange={(v) => set({ quality: v }, 'quality')} />
        </Field>
      </Advanced>
    </>
  );
}

function PositionField({ value, onChange }: { value: WidgetPosition; onChange: (v: WidgetPosition) => void }) {
  const t = useT();
  const cells: Array<WidgetPosition | null> = ['top-left', 'top-center', 'top-right', null, 'center', null, 'bottom-left', 'bottom-center', 'bottom-right'];
  return (
    <div className="position-grid" role="radiogroup" aria-label={t('prop.position')}>
      {cells.map((cell, i) =>
        cell ? (
          <button type="button" key={cell} role="radio" aria-checked={value === cell} className={value === cell ? 'active' : ''} title={t(`position.${cell}`)} onClick={() => onChange(cell)}>
            <Icon name="circle" size={8} strokeWidth={4} />
          </button>
        ) : (
          <span key={i} />
        ),
      )}
    </div>
  );
}

function FontField<L extends ClockLayer | TextLayer>({ layer, set }: { layer: L; set: Setter<L> }) {
  const t = useT();
  return (
    <Field label={t('prop.font')}>
      <Segmented
        value={layer.font}
        onChange={(v) => set({ font: v } as Partial<L>)}
        options={(['system', 'serif', 'mono', 'rounded'] as const).map((f) => ({ value: f, label: t(`font.${f}`) }))}
      />
    </Field>
  );
}

function ClockProps({ layer, set }: { layer: ClockLayer; set: Setter<ClockLayer> }) {
  const t = useT();
  return (
    <>
      <Field label={t('prop.position')}>
        <PositionField value={layer.position} onChange={(v) => set({ position: v })} />
      </Field>
      <Field label={t('prop.format')}>
        <Segmented value={layer.format} onChange={(v) => set({ format: v })} options={[{ value: '24h', label: '24h' }, { value: '12h', label: '12h (AM/PM)' }]} />
      </Field>
      <Field label={t('prop.showDate')}>
        <Toggle checked={layer.showDate} onChange={(v) => set({ showDate: v })} />
      </Field>
      <Field label={t('prop.showSeconds')}>
        <Toggle checked={layer.showSeconds} onChange={(v) => set({ showSeconds: v })} />
      </Field>
      <Field label={t('prop.fontSize')}>
        <Slider value={layer.fontSize} min={16} max={240} onChange={(v) => set({ fontSize: v }, 'fontSize')} format={(v) => `${v}px`} />
      </Field>
      <Field label={t('prop.color')}>
        <ColorField value={layer.color} onChange={(v) => v && set({ color: v }, 'color')} />
      </Field>
      <FontField layer={layer} set={set} />
    </>
  );
}

function TextProps({ layer, set }: { layer: TextLayer; set: Setter<TextLayer> }) {
  const t = useT();
  return (
    <>
      <Field label={t('prop.text')}>
        <textarea value={layer.text} maxLength={200} rows={3} onChange={(e) => set({ text: e.target.value }, 'text')} />
      </Field>
      <Field label={t('prop.position')}>
        <PositionField value={layer.position} onChange={(v) => set({ position: v })} />
      </Field>
      <Field label={t('prop.fontSize')}>
        <Slider value={layer.fontSize} min={12} max={200} onChange={(v) => set({ fontSize: v }, 'fontSize')} format={(v) => `${v}px`} />
      </Field>
      <Field label={t('prop.color')}>
        <ColorField value={layer.color} onChange={(v) => v && set({ color: v }, 'color')} />
      </Field>
      <FontField layer={layer} set={set} />
    </>
  );
}

function VisualizerProps({ layer, set }: { layer: VisualizerLayer; set: Setter<VisualizerLayer> }) {
  const t = useT();
  return (
    <>
      <Field label={t('prop.vizStyle')}>
        <Segmented value={layer.style} onChange={(v) => set({ style: v })} options={(['bars', 'wave', 'circle'] as const).map((v) => ({ value: v, label: t(`viz.style.${v}`) }))} />
      </Field>
      {layer.style !== 'circle' && (
        <Field label={t('prop.vizPosition')}>
          <Segmented value={layer.position} onChange={(v) => set({ position: v })} options={(['top', 'center', 'bottom'] as const).map((v) => ({ value: v, label: t(`viz.position.${v}`) }))} />
        </Field>
      )}
      <Field label={t('prop.colorA')}>
        <ColorField value={layer.colorA} onChange={(v) => v && set({ colorA: v }, 'colorA')} />
      </Field>
      <Field label={t('prop.colorB')}>
        <ColorField value={layer.colorB} onChange={(v) => v && set({ colorB: v }, 'colorB')} />
      </Field>
      <Field label={t('prop.vizHeight')}>
        <Slider value={layer.height} min={0.05} max={1} step={0.01} format={pct} onChange={(v) => set({ height: v }, 'height')} />
      </Field>
      <Field label={t('prop.vizSensitivity')} hint={t('prop.vizSensitivityHint')}>
        <Slider value={layer.sensitivity} min={0.2} max={4} step={0.1} format={(v) => `${v.toFixed(1)}×`} onChange={(v) => set({ sensitivity: v }, 'sensitivity')} />
      </Field>
      <Field label={t('prop.vizMirror')}>
        <Toggle checked={layer.mirror} onChange={(v) => set({ mirror: v })} />
      </Field>
      <Advanced>
        <Field label={t('prop.vizBands')}>
          <Slider value={layer.bands} min={16} max={128} step={8} onChange={(v) => set({ bands: v }, 'bands')} />
        </Field>
        <Field label={t('prop.vizSmoothing')} hint={t('prop.vizSmoothingHint')}>
          <Slider value={layer.smoothing} min={0} max={0.95} step={0.05} format={pct} onChange={(v) => set({ smoothing: v }, 'smoothing')} />
        </Field>
      </Advanced>
      <Tip>{t('prop.vizTip')}</Tip>
    </>
  );
}

function WebProps({ layer, set }: { layer: WebLayer; set: Setter<WebLayer> }) {
  const t = useT();
  const [draft, setDraft] = useState(layer.url);
  const valid = isHttpsUrl(draft.trim());
  const commit = () => {
    if (valid && draft.trim() !== layer.url) set({ url: draft.trim() });
  };
  return (
    <>
      <Field label={t('prop.url')} hint={t('prop.urlHint')}>
        <input
          type="url"
          value={draft}
          className={valid ? '' : 'invalid'}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          spellCheck={false}
        />
      </Field>
      {!valid && <div className="small danger-text">{t('prop.urlInvalid')}</div>}
      <Field label={t('prop.zoom')}>
        <Slider value={layer.zoom} min={0.25} max={3} step={0.05} format={pct} onChange={(v) => set({ zoom: v }, 'zoom')} />
      </Field>
      <Tip>{t('prop.webTip')}</Tip>
    </>
  );
}

function SysInfoProps({ layer, set }: { layer: SysInfoLayer; set: Setter<SysInfoLayer> }) {
  const t = useT();
  return (
    <>
      <Field label={t('prop.position')}>
        <PositionField value={layer.position} onChange={(v) => set({ position: v })} />
      </Field>
      <Field label={t('prop.sysStyle')}>
        <Segmented value={layer.style} onChange={(v) => set({ style: v })} options={(['bars', 'text'] as const).map((v) => ({ value: v, label: t(`sys.style.${v}`) }))} />
      </Field>
      <Field label={t('prop.showCpu')}>
        <Toggle checked={layer.showCpu} onChange={(v) => set({ showCpu: v })} />
      </Field>
      <Field label={t('prop.showRam')}>
        <Toggle checked={layer.showRam} onChange={(v) => set({ showRam: v })} />
      </Field>
      <Field label={t('prop.fontSize')}>
        <Slider value={layer.fontSize} min={10} max={64} onChange={(v) => set({ fontSize: v }, 'fontSize')} format={(v) => `${v}px`} />
      </Field>
      <Field label={t('prop.color')}>
        <ColorField value={layer.color} onChange={(v) => v && set({ color: v }, 'color')} />
      </Field>
    </>
  );
}

function useCaps() {
  return useStudio((s) => s.caps);
}

function unsupported(t: TFunction, supported: boolean | undefined, key = 'caps.windowsOnly') {
  return supported === false ? t(key) : undefined;
}

function ColorsSection({ theme }: { theme: Theme }) {
  const t = useT();
  const caps = useCaps();
  const edit = useStudio((s) => s.edit);
  const [picking, setPicking] = useState(false);
  const c = theme.colors;
  const pickFromWallpaper = async () => {
    setPicking(true);
    const accent = await extractAccent(theme);
    edit((d) => (d.colors.accent = accent));
    setPicking(false);
  };
  return (
    <div className="stack">
      <SectionTitle icon="palette">{t('section.colors')}</SectionTitle>
      <Field label={t('colors.accent')} hint={t('colors.accentHint')} disabled={caps?.accentColor === false} disabledReason={unsupported(t, caps?.accentColor)}>
        <ColorField value={c.accent} onChange={(v) => v && edit((d) => (d.colors.accent = v), 'accent')} />
        <Button size="sm" icon="wand" onClick={() => void pickFromWallpaper()} disabled={picking}>
          {t('colors.fromWallpaper')}
        </Button>
      </Field>
      <Field label={t('colors.mode')} disabled={caps?.darkMode === false} disabledReason={unsupported(t, caps?.darkMode)}>
        <Segmented
          value={c.mode}
          onChange={(v) => edit((d) => (d.colors.mode = v))}
          options={[
            { value: 'dark', label: t('colors.dark'), icon: 'moon' },
            { value: 'light', label: t('colors.light'), icon: 'sun' },
          ]}
        />
      </Field>
      <Field label={t('colors.accentOnTaskbar')} hint={t('colors.accentOnTaskbarHint')} disabled={caps?.accentOnTaskbar === false} disabledReason={unsupported(t, caps?.accentOnTaskbar)}>
        <Toggle checked={c.accentOnTaskbar} onChange={(v) => edit((d) => (d.colors.accentOnTaskbar = v))} />
      </Field>
      <Field label={t('colors.accentOnTitleBars')} disabled={caps?.accentOnTitleBars === false} disabledReason={unsupported(t, caps?.accentOnTitleBars)}>
        <Toggle checked={c.accentOnTitleBars} onChange={(v) => edit((d) => (d.colors.accentOnTitleBars = v))} />
      </Field>
      <Field label={t('colors.transparency')} hint={t('colors.transparencyHint')} disabled={caps?.transparency === false} disabledReason={unsupported(t, caps?.transparency)}>
        <Toggle checked={c.transparency} onChange={(v) => edit((d) => (d.colors.transparency = v))} />
      </Field>
      <Field label={t('colors.autoAccent')} hint={t('colors.autoAccentHint')}>
        <Toggle checked={c.autoAccentFromWallpaper} onChange={(v) => edit((d) => (d.colors.autoAccentFromWallpaper = v))} />
      </Field>
    </div>
  );
}

function WindowsSection({ theme }: { theme: Theme }) {
  const t = useT();
  const caps = useCaps();
  const edit = useStudio((s) => s.edit);
  const w = theme.windows;
  const needs11 = caps?.os === 'windows' ? 'caps.needsWin11' : 'caps.windowsOnly';
  return (
    <div className="stack">
      <SectionTitle icon="app-window">{t('section.windows')}</SectionTitle>
      <Field label={t('windows.animations')} hint={t('windows.animationsHint')} disabled={caps?.windowAnimations === false} disabledReason={unsupported(t, caps?.windowAnimations)}>
        <Toggle checked={w.animations} onChange={(v) => edit((d) => (d.windows.animations = v))} />
      </Field>
      <Field label={t('windows.corners')} disabled={caps?.windowCorners === false} disabledReason={unsupported(t, caps?.windowCorners, needs11)}>
        <Segmented
          value={w.corners}
          onChange={(v) => edit((d) => (d.windows.corners = v))}
          options={[
            { value: 'default', label: t('windows.corners.default') },
            { value: 'round', label: t('windows.corners.round'), icon: 'circle' },
            { value: 'round-small', label: t('windows.corners.small'), icon: 'square' },
            { value: 'square', label: t('windows.corners.square'), icon: 'square' },
          ]}
        />
      </Field>
      <Field label={t('windows.border')} hint={t('windows.borderHint')} disabled={caps?.windowColors === false} disabledReason={unsupported(t, caps?.windowColors, needs11)}>
        <ColorField value={w.borderColor} allowNone noneLabel={t('common.systemDefault')} onChange={(v) => edit((d) => (d.windows.borderColor = v), 'border')} />
      </Field>
      <Field label={t('windows.caption')} disabled={caps?.windowColors === false} disabledReason={unsupported(t, caps?.windowColors, needs11)}>
        <ColorField value={w.captionColor} allowNone noneLabel={t('common.systemDefault')} onChange={(v) => edit((d) => (d.windows.captionColor = v), 'caption')} />
      </Field>
      <Advanced>
        <Field label={t('windows.captionText')} disabled={caps?.windowColors === false} disabledReason={unsupported(t, caps?.windowColors, needs11)}>
          <ColorField value={w.captionTextColor} allowNone noneLabel={t('common.systemDefault')} onChange={(v) => edit((d) => (d.windows.captionTextColor = v), 'captionText')} />
        </Field>
      </Advanced>
      <Tip>{t('windows.tip')}</Tip>
    </div>
  );
}

function TaskbarSection({ theme }: { theme: Theme }) {
  const t = useT();
  const caps = useCaps();
  const edit = useStudio((s) => s.edit);
  const tb = theme.taskbar;
  const positions = caps?.taskbarPositions ?? ['bottom', 'top', 'left', 'right'];
  return (
    <div className="stack">
      <SectionTitle icon="panel-bottom">{t('section.taskbar')}</SectionTitle>
      <Field label={t('taskbar.position')} hint={t('taskbar.positionHint')} disabled={positions.length === 0} disabledReason={unsupported(t, positions.length > 0)}>
        <Segmented
          value={tb.position}
          onChange={(v) => edit((d) => (d.taskbar.position = v))}
          options={(['bottom', 'top', 'left', 'right'] as const).map((p) => ({ value: p, label: t(`taskbar.${p}`), disabled: !positions.includes(p) }))}
        />
      </Field>
      <Field label={t('taskbar.alignment')} disabled={caps?.taskbarAlignment === false} disabledReason={unsupported(t, caps?.taskbarAlignment, caps?.os === 'windows' ? 'caps.needsWin11' : 'caps.windowsOnly')}>
        <Segmented
          value={tb.alignment}
          onChange={(v) => edit((d) => (d.taskbar.alignment = v))}
          options={[
            { value: 'left', label: t('taskbar.alignLeft'), icon: 'align-left' },
            { value: 'center', label: t('taskbar.alignCenter'), icon: 'align-center' },
          ]}
        />
      </Field>
      <Field label={t('taskbar.autoHide')} hint={t('taskbar.autoHideHint')} disabled={caps?.taskbarAutoHide === false} disabledReason={unsupported(t, caps?.taskbarAutoHide)}>
        <Toggle checked={tb.autoHide} onChange={(v) => edit((d) => (d.taskbar.autoHide = v))} />
      </Field>
      <Field label={t('taskbar.size')} disabled={caps?.taskbarSize === false} disabledReason={unsupported(t, caps?.taskbarSize)}>
        <Segmented
          value={tb.size}
          onChange={(v) => edit((d) => (d.taskbar.size = v))}
          options={[
            { value: 'small', label: t('taskbar.small') },
            { value: 'default', label: t('taskbar.default') },
          ]}
        />
      </Field>
      {caps?.isWindows11 && <Tip>{t('taskbar.win11Tip')}</Tip>}
    </div>
  );
}

function DesktopSection({ theme }: { theme: Theme }) {
  const t = useT();
  const caps = useCaps();
  const edit = useStudio((s) => s.edit);
  return (
    <div className="stack">
      <SectionTitle icon="layout-grid">{t('section.desktop')}</SectionTitle>
      <Field label={t('desktop.showIcons')} disabled={caps?.desktopIcons === false} disabledReason={unsupported(t, caps?.desktopIcons)}>
        <Toggle checked={theme.desktop.showIcons} onChange={(v) => edit((d) => (d.desktop.showIcons = v))} />
      </Field>
      <Field label={t('desktop.iconSize')} hint={t('desktop.iconSizeHint')} disabled={caps?.desktopIcons === false} disabledReason={unsupported(t, caps?.desktopIcons)}>
        <Segmented
          value={theme.desktop.iconSize}
          onChange={(v) => edit((d) => (d.desktop.iconSize = v))}
          options={[
            { value: 'small', label: t('desktop.small') },
            { value: 'medium', label: t('desktop.medium') },
            { value: 'large', label: t('desktop.large') },
          ]}
        />
      </Field>
    </div>
  );
}

export function applyRecommendation(draft: Theme, key: string, layerId?: string): boolean {
  const layer = layerId ? draft.wallpaper.layers.find((l) => l.id === layerId) : undefined;
  switch (key) {
    case 'rec.lowerFps':
      draft.wallpaper.fpsLimit = 30;
      return true;
    case 'rec.shaderQuality':
      if (layer?.type === 'shader') layer.quality = 0.5;
      return true;
    case 'rec.particles':
      if (layer?.type === 'particles') layer.count = 300;
      return true;
    case 'rec.blurMotion':
      if (layer?.type === 'image') layer.blur = 0;
      return true;
    case 'rec.pauseFullscreen':
      draft.wallpaper.pauseOnFullscreen = true;
      return true;
    case 'rec.pauseBattery':
      draft.wallpaper.pauseOnBattery = true;
      return true;
    default:
      return false;
  }
}

export const FIXABLE = new Set(['rec.lowerFps', 'rec.shaderQuality', 'rec.particles', 'rec.blurMotion', 'rec.pauseFullscreen', 'rec.pauseBattery']);

function PerformanceSection({ theme, estimate }: { theme: Theme; estimate: Estimate }) {
  const t = useT();
  const { edit, go } = useStudio();
  const w = theme.wallpaper;
  return (
    <div className="stack">
      <SectionTitle icon="gauge">{t('section.performance')}</SectionTitle>
      <div className="row">
        <RatingBadge rating={estimate.rating} />
        <span className="muted small">{t('perf.scoreLine', { score: estimate.score, watts: estimate.extraWatts })}</span>
      </div>
      <Field label={t('perf.fpsLimit')} hint={t('perf.fpsLimitHint')}>
        <Segmented
          value={w.fpsLimit}
          onChange={(v) => edit((d) => (d.wallpaper.fpsLimit = v))}
          options={([15, 24, 30, 60, 120, 144] as const).map((f) => ({ value: f, label: String(f) }))}
        />
      </Field>
      <Field label={t('perf.pauseFullscreen')} hint={t('perf.pauseFullscreenHint')}>
        <Toggle checked={w.pauseOnFullscreen} onChange={(v) => edit((d) => (d.wallpaper.pauseOnFullscreen = v))} />
      </Field>
      <Field label={t('perf.pauseBattery')} hint={t('perf.pauseBatteryHint')}>
        <Toggle checked={w.pauseOnBattery} onChange={(v) => edit((d) => (d.wallpaper.pauseOnBattery = v))} />
      </Field>
      {estimate.recommendations.length > 0 && (
        <div className="stack-sm">
          <strong>{t('perf.recommendations')}</strong>
          {estimate.recommendations.map((r, i) => (
            <div key={i} className="rec">
              <span>
                {t(r.key, r.params)}
                {r.savingPercent > 0 && <span className="badge badge-ok">−{r.savingPercent}%</span>}
              </span>
              {FIXABLE.has(r.key) && (
                <Button size="sm" onClick={() => edit((d) => void applyRecommendation(d, r.key, r.layerId))}>
                  {t('perf.fix')}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      <Button icon="chart" onClick={() => go('performance', theme.id)}>
        {t('perf.openFullReport')}
      </Button>
    </div>
  );
}

function InfoSection({ theme }: { theme: Theme }) {
  const t = useT();
  const edit = useStudio((s) => s.edit);
  return (
    <div className="stack">
      <SectionTitle icon="info">{t('section.info')}</SectionTitle>
      <Field label={t('info.name')}>
        <input value={theme.name} maxLength={80} onChange={(e) => edit((d) => (d.name = e.target.value || ' '), 'name')} />
      </Field>
      <Field label={t('info.author')}>
        <input value={theme.author} maxLength={80} onChange={(e) => edit((d) => (d.author = e.target.value), 'author')} />
      </Field>
      <Field label={t('info.description')}>
        <textarea rows={5} maxLength={4000} value={theme.description} onChange={(e) => edit((d) => (d.description = e.target.value), 'description')} />
      </Field>
      <Field label={t('info.tags')} hint={t('info.tagsHint')}>
        <div className="tag-picker">
          {THEME_TAGS.map((tag) => {
            const on = theme.tags.includes(tag);
            return (
              <button
                type="button"
                key={tag}
                className={`tag ${on ? 'on' : ''}`}
                onClick={() => edit((d) => (d.tags = on ? d.tags.filter((x) => x !== tag) : [...d.tags, tag].slice(0, 12)))}
              >
                {t(`tag.${tag}`)}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}
