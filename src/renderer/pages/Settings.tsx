import { api, isDesktopApp } from '../app/api';
import { useT } from '../app/i18n';
import { useStudio } from '../app/store';
import { Button, Field, Segmented, Slider, Tip, Toggle } from '../components/ui';
import { Icon } from '../components/Icon';
import { summarizeApply } from './Library';

export function SettingsPage() {
  const t = useT();
  const { settings, updateSettings, caps, toast } = useStudio();
  if (!settings) return null;

  const restore = async () => {
    if (!window.confirm(t('settings.restoreConfirm'))) return;
    const result = await api.desktop.restoreOriginal();
    toast(result.ok ? 'success' : 'error', summarizeApply(result, t));
  };

  return (
    <div className="page narrow">
      <header className="page-header">
        <div>
          <h1>{t('settings.title')}</h1>
          <p className="muted">{caps?.osVersion}</p>
        </div>
      </header>
      <div className="card pad stack">
        <Field label={t('settings.language')}>
          <Segmented
            value={settings.language}
            onChange={(v) => void updateSettings({ language: v })}
            options={[
              { value: 'auto', label: t('settings.auto') },
              { value: 'ru', label: 'Русский' },
              { value: 'en', label: 'English' },
            ]}
          />
        </Field>
        <Field label={t('settings.author')} hint={t('settings.authorHint')}>
          <input value={settings.authorName} maxLength={80} onChange={(e) => void updateSettings({ authorName: e.target.value })} />
        </Field>
        <Field label={t('settings.beginner')} hint={t('settings.beginnerHint')}>
          <Toggle checked={settings.beginnerMode} onChange={(v) => void updateSettings({ beginnerMode: v })} />
        </Field>
        <Field label={t('settings.startup')} hint={t('settings.startupHint')}>
          <Toggle checked={settings.launchAtStartup} onChange={(v) => void updateSettings({ launchAtStartup: v })} disabled={!isDesktopApp} />
        </Field>
        <Field label={t('settings.explorerRestart')} hint={t('settings.explorerRestartHint')}>
          <Toggle checked={settings.allowExplorerRestart} onChange={(v) => void updateSettings({ allowExplorerRestart: v })} />
        </Field>
        <Field label={t('settings.restoreOnExit')} hint={t('settings.restoreOnExitHint')}>
          <Toggle checked={settings.restoreOnExit} onChange={(v) => void updateSettings({ restoreOnExit: v })} />
        </Field>
      </div>
      <div className="card pad stack">
        <h2 className="with-icon">
          <Icon name="sliders" size={18} /> {t('settings.wallpaperTitle')}
        </h2>
        <Field label={t('tray.volume')} hint={t('settings.volumeHint')}>
          <div className="row nowrap">
            <Button
              size="sm"
              variant="ghost"
              icon={settings.wallpaperMuted ? 'volume-off' : 'volume'}
              title={t('tray.mute')}
              onClick={() => void updateSettings({ wallpaperMuted: !settings.wallpaperMuted })}
            />
            <Slider
              value={settings.wallpaperVolume}
              min={0}
              max={1}
              step={0.01}
              disabled={settings.wallpaperMuted}
              format={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => void updateSettings({ wallpaperVolume: v })}
            />
          </div>
        </Field>
        <Field label={t('tray.saturation')} hint={t('settings.saturationHint')}>
          <Slider value={settings.wallpaperSaturation} min={0} max={2} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => void updateSettings({ wallpaperSaturation: v })} />
        </Field>
        <Field label={t('tray.speed')} hint={t('settings.speedHint')}>
          <Slider value={settings.wallpaperSpeed} min={0.25} max={2} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => void updateSettings({ wallpaperSpeed: v })} />
        </Field>
        <Tip>{t('settings.trayTip')}</Tip>
      </div>
      <div className="card pad stack">
        <h2 className="with-icon">
          <Icon name="lifebuoy" size={18} /> {t('settings.safety')}
        </h2>
        <p className="muted">{t('settings.safetyDesc')}</p>
        <div>
          <Button variant="danger" icon="restore" onClick={() => void restore()}>
            {t('settings.restore')}
          </Button>
        </div>
        <Tip>{t('settings.safetyTip')}</Tip>
      </div>
    </div>
  );
}
