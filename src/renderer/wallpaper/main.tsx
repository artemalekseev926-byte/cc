/**
 * Wallpaper host page: one per display, parented behind the desktop icons by
 * the main process. Receives the theme, pause state and cursor position over IPC.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { themeFileUrl } from '../../shared/ipc';
import type { Theme } from '../../shared/theme/schema';
import { Stage } from '../engine/Stage';
import type { Ticker } from '../engine/ticker';

const api = window.deskforge;

function WallpaperApp() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [paused, setPaused] = useState(false);
  const cursor = useRef<{ x: number; y: number } | null>(null);
  const tickerRef = useRef<Ticker | null>(null);

  useEffect(() => {
    const offs = [
      api.wallpaper.onTheme((t) => setTheme(t)),
      api.wallpaper.onPause((p) => setPaused(p)),
      api.wallpaper.onCursor((pos) => (cursor.current = pos)),
    ];
    api.wallpaper.ready();
    // Frame times feed the performance probe; cheap enough to always send.
    const id = setInterval(() => {
      const ticker = tickerRef.current;
      if (ticker) api.wallpaper.reportFrames({ frameTimesMs: ticker.drainFrameTimes() });
    }, 1000);
    return () => {
      offs.forEach((off) => off());
      clearInterval(id);
    };
  }, []);

  const assetUrl = useCallback(
    (key: string) => {
      const asset = theme?.assets[key];
      return theme && asset ? themeFileUrl(theme.id, asset.file) : undefined;
    },
    [theme],
  );
  const onTicker = useCallback((t: Ticker) => (tickerRef.current = t), []);

  if (!theme) return null;
  return (
    <Stage
      key={theme.id}
      theme={theme}
      assetUrl={assetUrl}
      paused={paused}
      cursor={cursor}
      onTicker={onTicker}
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}

createRoot(document.getElementById('root')!).render(<WallpaperApp />);
