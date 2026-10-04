import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import type {
  AudioLayer,
  SysInfoLayer,
  VisualizerLayer,
  WebLayer,
  ClockLayer,
  GradientLayer,
  ImageLayer,
  Layer,
  ParticlesLayer,
  ShaderLayer,
  TextLayer,
  Theme,
  VideoLayer,
  WidgetPosition,
} from '../../shared/theme/schema';
import { api } from '../app/api';
import { useT } from '../app/i18n';
import { systemAudio } from './audio';
import { ParticleSystem } from './particles';
import { ShaderRenderer } from './shaders';
import { Ticker } from './ticker';

export type CursorRef = MutableRefObject<{ x: number; y: number } | null>;

export interface StageControls {
  volume: number;
  muted: boolean;
  saturation: number;
  speed: number;
  brightness?: number;
  contrast?: number;
  hue?: number;
  fpsCap?: number;
}

export const DEFAULT_CONTROLS: StageControls = { volume: 0.7, muted: false, saturation: 1, speed: 1, brightness: 1, contrast: 1, hue: 0, fpsCap: 0 };

export function stageFilter(c: StageControls): string | undefined {
  const parts: string[] = [];
  if (Math.abs(c.saturation - 1) > 0.01) parts.push(`saturate(${c.saturation})`);
  if (c.brightness !== undefined && Math.abs(c.brightness - 1) > 0.01) parts.push(`brightness(${c.brightness})`);
  if (c.contrast !== undefined && Math.abs(c.contrast - 1) > 0.01) parts.push(`contrast(${c.contrast})`);
  if (c.hue) parts.push(`hue-rotate(${c.hue}deg)`);
  return parts.length ? parts.join(' ') : undefined;
}

function needsAudio(theme: Theme): boolean {
  return theme.wallpaper.layers.some((l) => l.visible && (l.type === 'visualizer' || (l.type === 'image' && l.beatPulse > 0)));
}

interface StageContext {
  ticker: Ticker;
  scale: number;
  paused: boolean;
  cursor: CursorRef;
  assetUrl: (key: string) => string | undefined;
  controls: StageControls;
  sound: boolean;
}

const Ctx = createContext<StageContext | null>(null);
const useStage = () => useContext(Ctx)!;

export interface StageProps {
  theme: Theme;
  assetUrl: (key: string) => string | undefined;
  paused?: boolean;
  scale?: number;
  cursor?: CursorRef;
  onTicker?: (ticker: Ticker) => void;
  className?: string;
  style?: CSSProperties;
  highlightLayerId?: string | null;
  controls?: StageControls;
  sound?: boolean;
}

export function Stage({
  theme,
  assetUrl,
  paused = false,
  scale = 1,
  cursor,
  onTicker,
  className,
  style,
  highlightLayerId,
  controls = DEFAULT_CONTROLS,
  sound = false,
}: StageProps) {
  const fallbackCursor = useRef<{ x: number; y: number } | null>(null);
  const [ticker] = useState(() => new Ticker(theme.wallpaper.fpsLimit));
  const cap = controls.fpsCap ?? 0;
  useEffect(() => ticker.setFps(cap > 0 ? Math.min(cap, theme.wallpaper.fpsLimit) : theme.wallpaper.fpsLimit), [ticker, theme.wallpaper.fpsLimit, cap]);
  const wantsAudio = needsAudio(theme) && !paused;
  useEffect(() => {
    if (!wantsAudio) return;
    void systemAudio.acquire();
    return () => systemAudio.release();
  }, [wantsAudio]);
  useEffect(() => ticker.setPaused(paused), [ticker, paused]);
  useEffect(() => ticker.setTimeScale(controls.speed), [ticker, controls.speed]);
  useEffect(() => {
    onTicker?.(ticker);
  }, [ticker, onTicker]);
  useEffect(() => () => ticker.dispose(), [ticker]);

  const ctx = useMemo<StageContext>(
    () => ({ ticker, scale, paused, cursor: cursor ?? fallbackCursor, assetUrl, controls, sound }),
    [ticker, scale, paused, cursor, assetUrl, controls, sound],
  );

  return (
    <Ctx.Provider value={ctx}>
      <div
        className={className}
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: '#000',
          filter: stageFilter(controls),
          ...style,
        }}
      >
        {theme.wallpaper.layers.map((layer) =>
          layer.visible ? (
            <div
              key={layer.id}
              style={{
                position: 'absolute',
                inset: 0,
                opacity: layer.opacity,
                mixBlendMode: layer.blendMode as CSSProperties['mixBlendMode'],
                outline: highlightLayerId === layer.id ? '2px dashed rgba(255,255,255,0.7)' : undefined,
                outlineOffset: -4,
                pointerEvents: 'none',
              }}
            >
              <LayerView layer={layer} theme={theme} />
            </div>
          ) : null,
        )}
      </div>
    </Ctx.Provider>
  );
}

function LayerView({ layer, theme }: { layer: Layer; theme: Theme }) {
  switch (layer.type) {
    case 'solid':
      return <div style={{ position: 'absolute', inset: 0, background: layer.color }} />;
    case 'gradient':
      return <GradientView layer={layer} />;
    case 'image':
      return <ImageView layer={layer} />;
    case 'video':
      return <VideoView layer={layer} theme={theme} />;
    case 'particles':
      return <ParticlesView layer={layer} />;
    case 'shader':
      return <ShaderView layer={layer} />;
    case 'clock':
      return <ClockView layer={layer} />;
    case 'text':
      return <TextView layer={layer} />;
    case 'audio':
      return <AudioView layer={layer} />;
    case 'visualizer':
      return <VisualizerView layer={layer} />;
    case 'web':
      return <WebView layer={layer} />;
    case 'sysinfo':
      return <SysInfoView layer={layer} />;
  }
}

function GradientView({ layer }: { layer: GradientLayer }) {
  const { ticker } = useStage();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!layer.animated) return;
    return ticker.subscribe((t) => {
      const phase = (t / layer.cycleSeconds) * Math.PI * 2;
      if (ref.current) ref.current.style.backgroundPosition = `${50 + 50 * Math.sin(phase)}% ${50 + 50 * Math.cos(phase * 0.7)}%`;
    });
  }, [ticker, layer.animated, layer.cycleSeconds]);
  const stops = [...layer.colors, layer.colors[0]].join(', ');
  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `linear-gradient(${layer.angle}deg, ${stops})`,
        backgroundSize: layer.animated ? '300% 300%' : '100% 100%',
        backgroundPosition: '50% 50%',
      }}
    />
  );
}

const FIT: Record<string, CSSProperties['objectFit']> = { cover: 'cover', contain: 'contain', fill: 'fill', center: 'none' };

function ImageView({ layer }: { layer: ImageLayer }) {
  const { ticker, assetUrl, cursor, scale } = useStage();
  const ref = useRef<HTMLImageElement>(null);
  const src = assetUrl(layer.asset);
  const moving = layer.parallax > 0 || layer.slowZoom || layer.beatPulse > 0;
  useEffect(() => {
    if (!moving) return;
    let pulse = 0;
    const pos = { x: 0, y: 0 };
    return ticker.subscribe((t, dt) => {
      const c = cursor.current;
      const tx = c ? (c.x - 0.5) * -2 : 0;
      const ty = c ? (c.y - 0.5) * -2 : 0;
      const ease = Math.min(1, dt * 4);
      pos.x += (tx - pos.x) * ease;
      pos.y += (ty - pos.y) * ease;
      const amp = layer.parallax * 30;
      const zoom = layer.slowZoom ? 0.04 * (1 + Math.sin(t * 0.05)) : 0;
      const base = 1 + layer.parallax * 0.08;
      if (layer.beatPulse > 0) pulse += (systemAudio.bass() - pulse) * Math.min(1, dt * 18);
      const beat = layer.beatPulse > 0 ? pulse * layer.beatPulse * 0.08 : 0;
      if (ref.current) ref.current.style.transform = `translate(${pos.x * amp}px, ${pos.y * amp}px) scale(${base + zoom + beat})`;
    });
  }, [ticker, moving, layer.parallax, layer.slowZoom, layer.beatPulse, cursor]);
  if (!src) return <MissingAsset />;
  return (
    <img
      ref={ref}
      src={src}
      alt=""
      draggable={false}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: FIT[layer.fit],
        filter: layer.blur > 0 ? `blur(${layer.blur * scale}px)` : undefined,
        willChange: moving ? 'transform' : undefined,
      }}
    />
  );
}

function effectiveVolume(layerVolume: number, controls: StageControls, sound: boolean) {
  return sound && !controls.muted ? Math.max(0, Math.min(1, layerVolume * controls.volume)) : 0;
}

function VideoView({ layer }: { layer: VideoLayer; theme: Theme }) {
  const { assetUrl, paused, controls, sound } = useStage();
  const ref = useRef<HTMLVideoElement>(null);
  const src = assetUrl(layer.asset);
  const volume = layer.sound ? effectiveVolume(layer.volume, controls, sound) : 0;
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.playbackRate = Math.max(0.0625, Math.min(16, layer.playbackRate * controls.speed));
    v.volume = volume;
    v.muted = volume === 0;
    if (paused || controls.speed === 0) v.pause();
    else void v.play().catch(() => undefined);
  }, [paused, layer.playbackRate, controls.speed, volume, src]);
  if (!src) return <MissingAsset />;
  return (
    <video
      ref={ref}
      src={src}
      autoPlay={!paused}
      loop
      muted
      playsInline
      disablePictureInPicture
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: FIT[layer.fit] }}
    />
  );
}

function useCanvasSize(ref: React.RefObject<HTMLCanvasElement | null>, onResize: (w: number, h: number) => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => onResize(entry.contentRect.width, entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
}

const canvasStyle: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' };

function ParticlesView({ layer }: { layer: ParticlesLayer }) {
  const { ticker, scale, cursor } = useStage();
  const ref = useRef<HTMLCanvasElement>(null);
  const sys = useRef<ParticleSystem | null>(null);
  useEffect(() => {
    sys.current = new ParticleSystem(ref.current!, layer, scale);
    const el = ref.current!;
    sys.current.resize(el.clientWidth, el.clientHeight);
    const unsub = ticker.subscribe((t, dt) => {
      sys.current?.setCursor(cursor.current);
      sys.current?.step(t, dt);
    });
    return () => {
      unsub();
      sys.current = null;
    };
  }, [ticker]);
  useEffect(() => sys.current?.update(layer, scale), [layer, scale]);
  useCanvasSize(ref, (w, h) => sys.current?.resize(w, h));
  return <canvas ref={ref} style={canvasStyle} />;
}

function ShaderView({ layer }: { layer: ShaderLayer }) {
  const { ticker } = useStage();
  const ref = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ShaderRenderer | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  useEffect(() => {
    const r = new ShaderRenderer(ref.current!, layer);
    if (!r.supported) {
      setUnsupported(true);
      return;
    }
    renderer.current = r;
    r.resize(ref.current!.clientWidth, ref.current!.clientHeight);
    const unsub = ticker.subscribe((t) => r.draw(t));
    r.draw(ticker.time);
    return () => {
      unsub();
      r.dispose();
      renderer.current = null;
    };
  }, [ticker]);
  useEffect(() => {
    renderer.current?.update(layer);
    renderer.current?.draw(ticker.time);
  }, [layer, ticker]);
  useCanvasSize(ref, (w, h) => {
    renderer.current?.resize(w, h);
    renderer.current?.draw(ticker.time);
  });
  if (unsupported) {
    return <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${layer.colorA}, ${layer.colorB})` }} />;
  }
  return <canvas ref={ref} style={{ ...canvasStyle, imageRendering: 'auto' }} />;
}

const FONTS: Record<string, string> = {
  system: '"Segoe UI Variable Display", "Segoe UI", system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"Cascadia Code", Consolas, "SF Mono", monospace',
  rounded: '"Nunito", "Segoe UI", system-ui, sans-serif',
};

function positionStyle(position: WidgetPosition, scale: number): CSSProperties {
  const [v, h] = position === 'center' ? ['center', 'center'] : position.split('-');
  const pad = 48 * scale;
  return {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: v === 'top' ? 'flex-start' : v === 'bottom' ? 'flex-end' : 'center',
    alignItems: h === 'left' ? 'flex-start' : h === 'right' ? 'flex-end' : 'center',
    padding: `${pad}px ${pad}px ${pad * 1.6}px`,
    textAlign: h === 'left' ? 'left' : h === 'right' ? 'right' : 'center',
  };
}

function ClockView({ layer }: { layer: ClockLayer }) {
  const { scale } = useStage();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), layer.showSeconds ? 1000 : 5000);
    return () => clearInterval(id);
  }, [layer.showSeconds]);
  const time = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: layer.showSeconds ? '2-digit' : undefined,
    hour12: layer.format === '12h',
  });
  const date = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <div style={positionStyle(layer.position, scale)}>
      <div
        style={{
          color: layer.color,
          fontFamily: FONTS[layer.font],
          fontSize: layer.fontSize * scale,
          fontWeight: 300,
          lineHeight: 1,
          textShadow: `0 ${2 * scale}px ${12 * scale}px rgba(0,0,0,0.35)`,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {time}
      </div>
      {layer.showDate && (
        <div style={{ color: layer.color, fontFamily: FONTS[layer.font], fontSize: layer.fontSize * 0.25 * scale, marginTop: 8 * scale, opacity: 0.85 }}>
          {date}
        </div>
      )}
    </div>
  );
}

function TextView({ layer }: { layer: TextLayer }) {
  const { scale } = useStage();
  return (
    <div style={positionStyle(layer.position, scale)}>
      <div
        style={{
          color: layer.color,
          fontFamily: FONTS[layer.font],
          fontSize: layer.fontSize * scale,
          whiteSpace: 'pre-wrap',
          textShadow: `0 ${1 * scale}px ${8 * scale}px rgba(0,0,0,0.35)`,
        }}
      >
        {layer.text}
      </div>
    </div>
  );
}

function AudioView({ layer }: { layer: AudioLayer }) {
  const { assetUrl, paused, controls, sound } = useStage();
  const ref = useRef<HTMLAudioElement>(null);
  const src = sound ? assetUrl(layer.asset) : undefined;
  const target = effectiveVolume(layer.volume, controls, sound);
  const started = useRef(false);
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    if (paused) {
      a.pause();
      return;
    }
    let raf = 0;
    if (!started.current && layer.fadeInSeconds > 0) {
      started.current = true;
      a.volume = 0;
      const start = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - start) / (layer.fadeInSeconds * 1000));
        a.volume = target * k;
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    } else {
      started.current = true;
      a.volume = target;
    }
    void a.play().catch(() => undefined);
    return () => cancelAnimationFrame(raf);
  }, [paused, target, layer.fadeInSeconds, src]);
  if (!src) return null;
  return <audio ref={ref} src={src} loop preload="auto" />;
}

function VisualizerView({ layer }: { layer: VisualizerLayer }) {
  const { ticker } = useStage();
  const ref = useRef<HTMLCanvasElement>(null);
  const size = useRef({ w: 0, h: 0 });
  useCanvasSize(ref, (w, h) => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    c.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
    size.current = { w, h };
  });
  useEffect(() => {
    const smooth = new Float32Array(layer.bands);
    const raw = new Float32Array(layer.bands);
    return ticker.subscribe(() => {
      const c = ref.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      if (!size.current.w) size.current = { w: c.clientWidth, h: c.clientHeight };
      const { w, h } = size.current;
      systemAudio.bands(layer.bands, raw);
      for (let i = 0; i < layer.bands; i++) {
        const v = Math.min(1, raw[i] * layer.sensitivity);
        smooth[i] = v > smooth[i] ? v : smooth[i] * layer.smoothing + v * (1 - layer.smoothing);
      }
      drawVisualizer(ctx, w, h, smooth, layer);
    });
  }, [ticker, layer]);
  return <canvas ref={ref} style={canvasStyle} />;
}

function drawVisualizer(ctx: CanvasRenderingContext2D, w: number, h: number, values: Float32Array, layer: VisualizerLayer) {
  ctx.clearRect(0, 0, w, h);
  const n = values.length;
  const maxH = h * layer.height;
  const baseY = layer.position === 'bottom' ? h : layer.position === 'top' ? 0 : h / 2;
  const dir = layer.position === 'top' ? 1 : -1;
  const grad =
    layer.position === 'top'
      ? ctx.createLinearGradient(0, 0, 0, maxH)
      : layer.position === 'center'
        ? ctx.createLinearGradient(0, h / 2 - maxH, 0, h / 2 + maxH)
        : ctx.createLinearGradient(0, h, 0, h - maxH);
  grad.addColorStop(0, layer.colorA);
  grad.addColorStop(1, layer.colorB);
  ctx.fillStyle = grad;
  ctx.strokeStyle = grad;
  const order = (i: number) => (layer.mirror ? values[Math.abs(Math.round((i - (n - 1) / 2) * 2)) % n] ?? 0 : values[i]);

  if (layer.style === 'circle') {
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.18;
    ctx.lineWidth = Math.max(2, ((Math.PI * 2 * r) / n) * 0.55);
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const v = layer.mirror ? values[i < n / 2 ? i * 2 : (n - 1 - i) * 2] ?? 0 : values[i];
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const len = 4 + v * Math.min(w, h) * layer.height * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.lineTo(cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len));
      ctx.stroke();
    }
    return;
  }

  if (layer.style === 'wave') {
    ctx.lineWidth = Math.max(2, h * 0.004);
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w;
      const v = order(i);
      const y = layer.position === 'center' ? baseY - v * maxH * (i % 2 ? 1 : -1) : baseY + dir * v * maxH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    return;
  }

  const gap = Math.max(1, (w / n) * 0.25);
  const bw = w / n - gap;
  for (let i = 0; i < n; i++) {
    const v = Math.max(0.02, order(i));
    const bh = v * maxH;
    const x = i * (bw + gap) + gap / 2;
    if (layer.position === 'center') ctx.fillRect(x, baseY - bh, bw, bh * 2);
    else ctx.fillRect(x, dir < 0 ? baseY - bh : baseY, bw, bh);
  }
}

function WebView({ layer }: { layer: WebLayer }) {
  const { scale } = useStage();
  const zoom = layer.zoom * Math.max(scale, 0.2);
  return (
    <iframe
      src={layer.url}
      title=""
      sandbox="allow-scripts allow-same-origin"
      referrerPolicy="no-referrer"
      tabIndex={-1}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: `${100 / zoom}%`,
        height: `${100 / zoom}%`,
        transform: `scale(${zoom})`,
        transformOrigin: '0 0',
        border: 'none',
        pointerEvents: 'none',
        background: '#000',
      }}
    />
  );
}

interface SysInfo {
  cpu: number;
  ram: number;
  ramUsedGb: number;
  ramTotalGb: number;
}

function SysInfoView({ layer }: { layer: SysInfoLayer }) {
  const { scale, paused } = useStage();
  const t = useT();
  const [info, setInfo] = useState<SysInfo | null>(null);
  useEffect(() => {
    if (paused) return;
    let alive = true;
    const poll = async () => {
      const next = await api.system.sysinfo().catch(() => null);
      if (alive && next) setInfo(next);
    };
    void poll();
    const id = setInterval(poll, 2000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [paused]);
  const rows: Array<{ label: string; value: number; extra?: string }> = [];
  if (layer.showCpu) rows.push({ label: t('sysinfo.cpu'), value: info?.cpu ?? 0 });
  if (layer.showRam) rows.push({ label: t('sysinfo.ram'), value: info?.ram ?? 0, extra: info ? `${info.ramUsedGb.toFixed(1)} / ${info.ramTotalGb.toFixed(0)} GB` : '' });
  const fs = layer.fontSize * scale;
  return (
    <div style={positionStyle(layer.position, scale)}>
      <div style={{ color: layer.color, fontFamily: FONTS.mono, fontSize: fs, display: 'grid', gap: fs * 0.5, minWidth: fs * 10, textShadow: '0 1px 6px rgba(0,0,0,.4)' }}>
        {rows.map((r) => (
          <div key={r.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: fs }}>
              <span style={{ opacity: 0.8 }}>{r.label}</span>
              <span>{Math.round(r.value)}%</span>
            </div>
            {layer.style === 'bars' && (
              <div style={{ height: Math.max(2, fs * 0.3), borderRadius: fs, background: 'rgba(255,255,255,.18)', overflow: 'hidden', marginTop: fs * 0.2 }}>
                <div style={{ width: `${Math.min(100, r.value)}%`, height: '100%', background: layer.color, transition: 'width .8s ease' }} />
              </div>
            )}
            {r.extra && <div style={{ fontSize: fs * 0.65, opacity: 0.7, marginTop: fs * 0.15 }}>{r.extra}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function MissingAsset() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'repeating-linear-gradient(45deg, #222 0 20px, #2a2a2a 20px 40px)',
      }}
    />
  );
}
