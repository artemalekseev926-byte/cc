import { createContext, useContext, useEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject } from 'react';
import type {
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
import { ParticleSystem } from './particles';
import { ShaderRenderer } from './shaders';
import { Ticker } from './ticker';

export type CursorRef = MutableRefObject<{ x: number; y: number } | null>;

interface StageContext {
  ticker: Ticker;
  scale: number;
  paused: boolean;
  cursor: CursorRef;
  assetUrl: (key: string) => string | undefined;
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
}

export function Stage({ theme, assetUrl, paused = false, scale = 1, cursor, onTicker, className, style, highlightLayerId }: StageProps) {
  const fallbackCursor = useRef<{ x: number; y: number } | null>(null);
  const [ticker] = useState(() => new Ticker(theme.wallpaper.fpsLimit));
  useEffect(() => ticker.setFps(theme.wallpaper.fpsLimit), [ticker, theme.wallpaper.fpsLimit]);
  useEffect(() => ticker.setPaused(paused), [ticker, paused]);
  useEffect(() => {
    onTicker?.(ticker);
  }, [ticker, onTicker]);
  useEffect(() => () => ticker.dispose(), [ticker]);

  const ctx = useMemo<StageContext>(
    () => ({ ticker, scale, paused, cursor: cursor ?? fallbackCursor, assetUrl }),
    [ticker, scale, paused, cursor, assetUrl],
  );

  return (
    <Ctx.Provider value={ctx}>
      <div className={className} style={{ position: 'relative', overflow: 'hidden', background: '#000', ...style }}>
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
  const moving = layer.parallax > 0 || layer.slowZoom;
  useEffect(() => {
    if (!moving) return;
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
      if (ref.current) ref.current.style.transform = `translate(${pos.x * amp}px, ${pos.y * amp}px) scale(${base + zoom})`;
    });
  }, [ticker, moving, layer.parallax, layer.slowZoom, cursor]);
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

function VideoView({ layer }: { layer: VideoLayer; theme: Theme }) {
  const { assetUrl, paused } = useStage();
  const ref = useRef<HTMLVideoElement>(null);
  const src = assetUrl(layer.asset);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.playbackRate = layer.playbackRate;
    if (paused) v.pause();
    else void v.play().catch(() => undefined);
  }, [paused, layer.playbackRate, src]);
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
