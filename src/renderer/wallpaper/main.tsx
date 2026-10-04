import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { themeFileUrl } from '../../shared/ipc';
import type { Theme } from '../../shared/theme/schema';
import { DEFAULT_CONTROLS, Stage, type StageControls } from '../engine/Stage';
import type { Ticker } from '../engine/ticker';

const api = window.deskforge;
const SOUND = new URLSearchParams(location.search).get('sound') === '1';

function WallpaperApp() {
  const [theme, setTheme] = useState<Theme | null>(null);
  const [paused, setPaused] = useState(false);
  const [controls, setControls] = useState<StageControls>(DEFAULT_CONTROLS);
  const cursor = useRef<{ x: number; y: number } | null>(null);
  const tickerRef = useRef<Ticker | null>(null);

  useEffect(() => {
    const offs = [
      api.wallpaper.onTheme((t) => setTheme(t)),
      api.wallpaper.onPause((p) => setPaused(p)),
      api.wallpaper.onCursor((pos) => (cursor.current = pos)),
      api.wallpaper.onControls((c) => setControls(c)),
    ];
    api.wallpaper.ready();
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
      controls={controls}
      sound={SOUND}
      cursor={cursor}
      onTicker={onTicker}
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}

createRoot(document.getElementById('root')!).render(<WallpaperApp />);
