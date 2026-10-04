/**
 * A miniature, fully-live mock of the Windows desktop: the real wallpaper
 * engine underneath, plus a taskbar, desktop icons and a sample window that
 * reflect the theme's colors, corners, borders and layout.
 */
import { forwardRef, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { readableOn, shade } from '../../shared/color';
import type { Theme } from '../../shared/theme/schema';
import { assetResolver } from '../app/store';
import { Stage } from '../engine/Stage';

interface Props {
  theme: Theme;
  /** Physical width of the display being simulated (for scaling widgets and particles). */
  displayWidth: number;
  aspect?: number;
  paused?: boolean;
  chrome?: boolean;
  highlightLayerId?: string | null;
  className?: string;
}

const ICONS = ['🗑️', '📁', '🎮', '🌐', '📝', '🎵'];

export const DesktopPreview = forwardRef<HTMLDivElement, Props>(function DesktopPreview(
  { theme, displayWidth, aspect = 16 / 9, paused, chrome = true, highlightLayerId, className },
  ref,
) {
  const cursor = useRef<{ x: number; y: number } | null>(null);
  const [width, setWidth] = useState(800);
  const assetUrl = useMemo(() => assetResolver(theme), [theme]);
  const scale = width / displayWidth;

  const box = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width || 800));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const { colors, windows, taskbar, desktop } = theme;
  const dark = colors.mode === 'dark';
  const accent = colors.accent.slice(0, 7);
  const surface = dark ? 'rgba(32,32,36,' : 'rgba(243,243,243,';
  const alpha = colors.transparency ? '0.78)' : '1)';
  const barColor = colors.accentOnTaskbar ? `${shade(accent, -0.45)}${colors.transparency ? 'd0' : ''}` : surface + alpha;
  const vertical = taskbar.position === 'left' || taskbar.position === 'right';
  const barThickness = (taskbar.size === 'small' ? 32 : 48) * scale;
  const radius = { default: 8, round: 12, 'round-small': 4, square: 0 }[windows.corners] * scale;
  const caption = windows.captionColor ?? (colors.accentOnTitleBars ? accent : dark ? '#202024' : '#f3f3f3');
  const captionText = windows.captionTextColor ?? readableOn(caption);
  const border = windows.borderColor ?? (colors.accentOnTitleBars ? accent : dark ? '#3a3a3f' : '#d0d0d0');
  const iconPx = { small: 28, medium: 40, large: 64 }[desktop.iconSize] * scale;

  const barStyle: CSSProperties = {
    position: 'absolute',
    background: barColor,
    backdropFilter: colors.transparency ? 'blur(12px)' : undefined,
    display: 'flex',
    flexDirection: vertical ? 'column' : 'row',
    alignItems: 'center',
    justifyContent: taskbar.alignment === 'center' && !vertical ? 'center' : 'flex-start',
    gap: 6 * scale,
    padding: 6 * scale,
    opacity: taskbar.autoHide ? 0.25 : 1,
    transition: 'all .3s ease',
    ...(taskbar.position === 'bottom' && { left: 0, right: 0, bottom: 0, height: barThickness }),
    ...(taskbar.position === 'top' && { left: 0, right: 0, top: 0, height: barThickness }),
    ...(taskbar.position === 'left' && { top: 0, bottom: 0, left: 0, width: barThickness }),
    ...(taskbar.position === 'right' && { top: 0, bottom: 0, right: 0, width: barThickness }),
  };
  const tile = barThickness * 0.62;

  return (
    <div
      ref={(el) => {
        box.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      className={`desktop-preview ${className ?? ''}`}
      style={{ aspectRatio: String(aspect) }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        cursor.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      }}
      onMouseLeave={() => (cursor.current = null)}
    >
      <Stage theme={theme} assetUrl={assetUrl} paused={paused} scale={scale} cursor={cursor} highlightLayerId={highlightLayerId} style={{ position: 'absolute', inset: 0 }} />

      {chrome && desktop.showIcons && (
        <div
          className="preview-icons"
          style={{
            top: (taskbar.position === 'top' ? barThickness : 0) + 10 * scale,
            left: (taskbar.position === 'left' ? barThickness : 0) + 10 * scale,
            gap: 14 * scale,
          }}
        >
          {ICONS.slice(0, 4).map((icon) => (
            <div key={icon} style={{ fontSize: iconPx * 0.8, width: iconPx * 1.4, textAlign: 'center' }}>
              {icon}
            </div>
          ))}
        </div>
      )}

      {chrome && (
        <div
          className="preview-window"
          style={{
            left: '28%',
            top: '18%',
            width: '44%',
            height: '46%',
            borderRadius: radius,
            border: `${Math.max(1, 1.5 * scale)}px solid ${border}`,
            background: dark ? '#1c1c20' : '#ffffff',
            boxShadow: `0 ${16 * scale}px ${48 * scale}px rgba(0,0,0,.45)`,
          }}
        >
          <div className="preview-caption" style={{ background: caption, color: captionText, height: 30 * scale, fontSize: 11 * scale, padding: `0 ${10 * scale}px` }}>
            <span>DeskForge</span>
            <span style={{ letterSpacing: 10 * scale }}>— ▢ ✕</span>
          </div>
          <div style={{ padding: 14 * scale, display: 'grid', gap: 8 * scale }}>
            <div style={{ height: 10 * scale, width: '60%', borderRadius: 4 * scale, background: dark ? '#34343a' : '#e6e6e6' }} />
            <div style={{ height: 10 * scale, width: '85%', borderRadius: 4 * scale, background: dark ? '#2a2a30' : '#efefef' }} />
            <div style={{ height: 26 * scale, width: 90 * scale, borderRadius: 6 * scale, background: accent, marginTop: 6 * scale }} />
          </div>
        </div>
      )}

      {chrome && (
        <div style={barStyle}>
          <div style={{ width: tile, height: tile, borderRadius: 6 * scale, background: accent, display: 'grid', placeItems: 'center', fontSize: tile * 0.5, color: readableOn(accent) }}>⊞</div>
          {ICONS.map((icon, i) => (
            <div
              key={icon}
              style={{
                width: tile,
                height: tile,
                borderRadius: 6 * scale,
                display: 'grid',
                placeItems: 'center',
                fontSize: tile * 0.55,
                background: i === 2 ? (dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)') : undefined,
                borderBottom: i === 2 ? `${2 * scale}px solid ${accent}` : undefined,
              }}
            >
              {icon}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
