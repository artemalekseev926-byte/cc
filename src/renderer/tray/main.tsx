import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { resolveLang, translate } from '../../shared/i18n';
import type { DesktopStatus, Settings } from '../../shared/ipc';
import { BrandMark } from '../components/BrandMark';
import { Icon } from '../components/Icon';
import { Slider, Toggle } from '../components/ui';
import '../app/styles.css';

import { api } from '../app/api';

function useThrottledSetter(delay = 60) {
  const timer = useRef<number | null>(null);
  const pending = useRef<Partial<Settings>>({});
  return useCallback(
    (patch: Partial<Settings>) => {
      pending.current = { ...pending.current, ...patch };
      if (timer.current !== null) return;
      timer.current = window.setTimeout(() => {
        timer.current = null;
        const p = pending.current;
        pending.current = {};
        void api.settings.set(p);
      }, delay);
    },
    [delay],
  );
}

function TrayApp() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<DesktopStatus | null>(null);
  const [themeName, setThemeName] = useState<string | null>(null);
  const setLater = useThrottledSetter();

  const refresh = useCallback(async () => {
    const [s, st] = await Promise.all([api.settings.get(), api.desktop.status()]);
    setSettings(s);
    setStatus(st);
    if (st.activeThemeId) {
      const list = await api.themes.list();
      setThemeName(list.find((x) => x.id === st.activeThemeId)?.name ?? st.activeThemeId);
    } else {
      setThemeName(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const offs = [api.settings.onChanged(setSettings), api.desktop.onStatus(() => void refresh())];
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && api.app.hideFlyout();
    window.addEventListener('keydown', onKey);
    return () => {
      offs.forEach((off) => off());
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('keydown', onKey);
    };
  }, [refresh]);

  if (!settings || !status) return null;
  const lang = resolveLang(settings.language, navigator.language);
  const t = (key: string, params?: Record<string, string | number>) => translate(lang, key, params);
  const update = (patch: Partial<Settings>) => {
    setSettings({ ...settings, ...patch });
    setLater(patch);
  };
  const manual = status.pauseReason === 'manual';
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="tray">
      <header className="tray-header">
        <BrandMark size={30} />
        <div className="tray-title">
          <strong>DeskForge</strong>
          <span className="muted small">
            {status.running ? (status.paused ? t(`status.paused.${status.pauseReason ?? 'manual'}`) : themeName ?? t('status.running')) : t('status.idle')}
          </span>
        </div>
        <button type="button" className="icon-btn" title={t('tray.close')} onClick={() => api.app.hideFlyout()}>
          <Icon name="x" size={16} />
        </button>
      </header>

      <section className="tray-controls">
        <div className="tray-row">
          <button
            type="button"
            className={`icon-btn tray-mute ${settings.wallpaperMuted ? 'active' : ''}`}
            title={t('tray.mute')}
            onClick={() => update({ wallpaperMuted: !settings.wallpaperMuted })}
          >
            <Icon name={settings.wallpaperMuted ? 'volume-off' : 'volume'} size={18} />
          </button>
          <div className="tray-slider">
            <span className="small">{t('tray.volume')}</span>
            <Slider value={settings.wallpaperVolume} min={0} max={1} step={0.01} format={pct} disabled={settings.wallpaperMuted} onChange={(v) => update({ wallpaperVolume: v })} />
          </div>
        </div>
        <div className="tray-row">
          <span className="tray-glyph">
            <Icon name="contrast" size={18} />
          </span>
          <div className="tray-slider">
            <span className="small">{t('tray.saturation')}</span>
            <Slider value={settings.wallpaperSaturation} min={0} max={2} step={0.05} format={pct} onChange={(v) => update({ wallpaperSaturation: v })} />
          </div>
        </div>
        <div className="tray-row">
          <span className="tray-glyph">
            <Icon name="zap" size={18} />
          </span>
          <div className="tray-slider">
            <span className="small">{t('tray.speed')}</span>
            <Slider value={settings.wallpaperSpeed} min={0.25} max={2} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => update({ wallpaperSpeed: v })} />
          </div>
        </div>
        <button type="button" className="link small tray-reset" onClick={() => update({ wallpaperVolume: 0.7, wallpaperSaturation: 1, wallpaperSpeed: 1, wallpaperMuted: false })}>
          {t('tray.reset')}
        </button>
      </section>

      <section className="tray-actions">
        <button type="button" className="tray-action" disabled={!status.running} onClick={() => void api.desktop.setPaused(!manual)}>
          <Icon name={manual ? 'play' : 'pause'} size={18} />
          <span>{manual ? t('tray.resume') : t('tray.pause')}</span>
        </button>
        <button type="button" className="tray-action" disabled={!status.running} onClick={() => void api.desktop.stop()}>
          <Icon name="stop" size={18} />
          <span>{t('tray.stop')}</span>
        </button>
      </section>

      <section className="tray-toggle">
        <Toggle checked={settings.launchAtStartup} onChange={(v) => update({ launchAtStartup: v })} label={t('settings.startup')} />
      </section>

      <footer className="tray-footer">
        <button type="button" className="btn btn-primary btn-md" onClick={() => api.app.showStudio()}>
          <Icon name="app-window" size={16} /> {t('tray.open')}
        </button>
        <button type="button" className="btn btn-ghost btn-md" onClick={() => api.app.quit()} title={t('tray.quit')}>
          <Icon name="power" size={16} />
        </button>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<TrayApp />);
