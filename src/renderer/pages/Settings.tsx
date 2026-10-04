import { api, isDesktopApp } from '../app/api';
import { useT } from '../app/i18n';
import { useStudio } from '../app/store';
import { Button, Field, Segmented, Tip, Toggle } from '../components/ui';
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
        <h2>🛟 {t('settings.safety')}</h2>
        <p className="muted">{t('settings.safetyDesc')}</p>
        <div>
          <Button variant="danger" icon="↺" onClick={() => void restore()}>
            {t('settings.restore')}
          </Button>
        </div>
        <Tip>{t('settings.safetyTip')}</Tip>
      </div>
    </div>
  );
}
