import { useEffect, useState } from 'react';
import { Editor } from '../editor/Editor';
import { Library, NewThemeDialog } from '../pages/Library';
import { Performance } from '../pages/Performance';
import { SettingsPage } from '../pages/Settings';
import { Workshop } from '../pages/Workshop';
import { Button, Field, Modal, Segmented, Toggle } from '../components/ui';
import { useT } from './i18n';
import { useStudio, type Route } from './store';

const NAV: Array<{ route: Route; icon: string }> = [
  { route: 'library', icon: '🖼️' },
  { route: 'editor', icon: '✏️' },
  { route: 'workshop', icon: '☁️' },
  { route: 'performance', icon: '⚡' },
  { route: 'settings', icon: '⚙️' },
];

export function App() {
  const t = useT();
  const { route, go, init, settings, desktop, toasts, dismissToast, library, editor } = useStudio();
  const [ready, setReady] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void init().then(() => setReady(true));
  }, [init]);

  const navigate = (r: Route) => {
    if (route === 'editor' && r !== 'editor' && editor.dirty && !window.confirm(t('editor.leaveUnsaved'))) return;
    go(r);
  };

  if (!ready || !settings) return <div className="splash">DeskForge</div>;
  const active = library.find((s) => s.id === desktop.activeThemeId);

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <span className="brand-mark">◆</span>
          <span>DeskForge</span>
        </div>
        {NAV.map((n) => (
          <button type="button" key={n.route} className={`nav-item ${route === n.route ? 'active' : ''}`} onClick={() => navigate(n.route)}>
            <span className="nav-icon">{n.icon}</span>
            <span>{t(`nav.${n.route}`)}</span>
          </button>
        ))}
        <div className="sidebar-footer">
          {desktop.running ? (
            <div className="now-playing">
              <span className="muted small">{t('status.onDesktop')}</span>
              <strong>{active?.name ?? desktop.activeThemeId}</strong>
              <span className="small">{desktop.paused ? `⏸ ${t(`status.paused.${desktop.pauseReason ?? 'manual'}`)}` : `▶ ${t('status.running')}`}</span>
            </div>
          ) : (
            <span className="muted small">{t('status.idle')}</span>
          )}
        </div>
      </nav>
      <main className="content">
        {route === 'library' && <Library />}
        {route === 'editor' && <Editor />}
        {route === 'workshop' && <Workshop />}
        {route === 'performance' && <Performance />}
        {route === 'settings' && <SettingsPage />}
      </main>
      <div className="toasts">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.kind}`} onClick={() => dismissToast(toast.id)}>
            {toast.text}
          </div>
        ))}
      </div>
      {!settings.onboardingDone && <Onboarding onCreate={() => setCreating(true)} />}
      {creating && <NewThemeDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function Onboarding({ onCreate }: { onCreate: () => void }) {
  const t = useT();
  const { settings, updateSettings } = useStudio();
  const [step, setStep] = useState(0);
  if (!settings) return null;
  const finish = (create: boolean) => {
    void updateSettings({ onboardingDone: true });
    if (create) onCreate();
  };
  return (
    <Modal title={t('onboarding.title')} onClose={() => finish(false)}>
      {step === 0 ? (
        <div className="stack">
          <p>{t('onboarding.intro')}</p>
          <ul className="feature-list">
            <li>🖼️ {t('onboarding.f1')}</li>
            <li>✏️ {t('onboarding.f2')}</li>
            <li>⚡ {t('onboarding.f3')}</li>
            <li>☁️ {t('onboarding.f4')}</li>
          </ul>
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
          <div className="row end">
            <Button variant="primary" onClick={() => setStep(1)}>
              {t('common.next')} →
            </Button>
          </div>
        </div>
      ) : (
        <div className="stack">
          <Field label={t('settings.author')} hint={t('settings.authorHint')}>
            <input value={settings.authorName} placeholder={t('onboarding.namePlaceholder')} onChange={(e) => void updateSettings({ authorName: e.target.value })} />
          </Field>
          <Field label={t('settings.beginner')} hint={t('settings.beginnerHint')}>
            <Toggle checked={settings.beginnerMode} onChange={(v) => void updateSettings({ beginnerMode: v })} label={settings.beginnerMode ? t('onboarding.beginnerOn') : t('onboarding.beginnerOff')} />
          </Field>
          <div className="row end">
            <Button onClick={() => finish(false)}>{t('onboarding.explore')}</Button>
            <Button variant="primary" onClick={() => finish(true)}>
              {t('onboarding.createFirst')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
