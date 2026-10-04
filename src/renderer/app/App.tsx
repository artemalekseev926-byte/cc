import { useEffect, useState } from 'react';
import { Editor } from '../editor/Editor';
import { Library, NewThemeDialog } from '../pages/Library';
import { Performance } from '../pages/Performance';
import { SettingsPage } from '../pages/Settings';
import { Share, errorKey } from '../pages/Share';
import { SystemPage } from '../pages/System';
import { AUTHOR_GITHUB_URL } from '../../shared/ipc';
import { api, isDesktopApp } from './api';
import { BrandMark } from '../components/BrandMark';
import { Icon, type IconName } from '../components/Icon';
import { Button, Field, Modal, Segmented, Toggle } from '../components/ui';
import { useT } from './i18n';
import { useStudio, type Route } from './store';

const NAV: Array<{ route: Route; icon: IconName }> = [
  { route: 'library', icon: 'image' },
  { route: 'editor', icon: 'pencil' },
  { route: 'share', icon: 'package' },
  { route: 'system', icon: 'monitor-cog' },
  { route: 'performance', icon: 'gauge' },
  { route: 'settings', icon: 'settings' },
];

export function App() {
  const t = useT();
  const { route, go, init, settings, desktop, toasts, dismissToast, library, editor } = useStudio();
  const [ready, setReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  useEffect(() => {
    void init().then(() => {
      setReady(true);
      const s = useStudio.getState().settings;
      if (s && s.onboardingDone && !s.supportPromptDisabled && s.launchCount > 0 && s.launchCount % 3 === 0) setSupportOpen(true);
    });
  }, [init]);

  useEffect(() => api.settings.onChanged((s) => useStudio.setState({ settings: s })), []);

  useEffect(
    () =>
      api.themes.onImported((info) => {
        useStudio.getState().toast('success', t('share.imported', { name: info.name }));
        useStudio.getState().go('library');
      }),
    [t],
  );

  const onDropPackages = async (e: React.DragEvent) => {
    const paths = [...e.dataTransfer.files].map((f) => api.themes.pathForFile(f)).filter((p) => p.toLowerCase().endsWith('.deskforge'));
    if (paths.length === 0) return;
    e.preventDefault();
    for (const path of paths) {
      try {
        const theme = await api.themes.importPackage(path);
        if (theme) useStudio.getState().toast('success', t('share.imported', { name: theme.name }));
      } catch (err) {
        useStudio.getState().toast('error', t(errorKey(err)));
      }
    }
  };

  const navigate = (r: Route) => {
    if (route === 'editor' && r !== 'editor' && editor.dirty && !window.confirm(t('editor.leaveUnsaved'))) return;
    go(r);
  };

  if (!ready || !settings) return <div className="splash">DeskForge</div>;
  const active = library.find((s) => s.id === desktop.activeThemeId);

  return (
    <div className="app" onDragOver={(e) => e.preventDefault()} onDrop={(e) => void onDropPackages(e)}>
      <nav className="sidebar">
        <div className="brand">
          <BrandMark size={26} />
          <span>DeskForge</span>
        </div>
        {NAV.map((n) => (
          <button type="button" key={n.route} className={`nav-item ${route === n.route ? 'active' : ''}`} onClick={() => navigate(n.route)}>
            <Icon name={n.icon} size={18} className="nav-icon" />
            <span>{t(`nav.${n.route}`)}</span>
          </button>
        ))}
        <div className="sidebar-footer">
          {desktop.running ? (
            <div className="now-playing">
              <span className="muted small">{t('status.onDesktop')}</span>
              <strong>{active?.name ?? desktop.activeThemeId}</strong>
              <span className="small with-icon">
                <Icon name={desktop.paused ? 'pause' : 'play'} size={12} />
                {desktop.paused ? t(`status.paused.${desktop.pauseReason ?? 'manual'}`) : t('status.running')}
              </span>
            </div>
          ) : (
            <span className="muted small">{t('status.idle')}</span>
          )}
        </div>
      </nav>
      <main className="content">
        {route === 'library' && <Library />}
        {route === 'editor' && <Editor />}
        {route === 'share' && <Share />}
        {route === 'system' && <SystemPage />}
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
      {supportOpen && <SupportPrompt onClose={() => setSupportOpen(false)} />}
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
            <li>
              <Icon name="image" size={16} /> {t('onboarding.f1')}
            </li>
            <li>
              <Icon name="pencil" size={16} /> {t('onboarding.f2')}
            </li>
            <li>
              <Icon name="music" size={16} /> {t('onboarding.f5')}
            </li>
            <li>
              <Icon name="gauge" size={16} /> {t('onboarding.f3')}
            </li>
            <li>
              <Icon name="package" size={16} /> {t('onboarding.f4')}
            </li>
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
              {t('common.next')}
              <Icon name="arrow-right" size={16} />
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
          <Field label={t('settings.startup')} hint={t('settings.startupHint')}>
            <Toggle checked={settings.launchAtStartup} disabled={!isDesktopApp} onChange={(v) => void updateSettings({ launchAtStartup: v })} />
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

function SupportPrompt({ onClose }: { onClose: () => void }) {
  const t = useT();
  const updateSettings = useStudio((s) => s.updateSettings);
  const yes = () => {
    window.open(AUTHOR_GITHUB_URL, '_blank');
    onClose();
  };
  const never = () => {
    void updateSettings({ supportPromptDisabled: true });
    onClose();
  };
  return (
    <Modal title={t('support.title')} onClose={onClose}>
      <div className="stack support">
        <div className="support-art" aria-hidden="true">
          <Icon name="heart" size={34} strokeWidth={1.6} />
          <Icon name="star" size={26} strokeWidth={1.6} />
          <Icon name="thumbs-up" size={30} strokeWidth={1.6} />
        </div>
        <p>{t('support.text')}</p>
        <p className="muted small">{t('support.hint')}</p>
        <div className="row end">
          <Button variant="ghost" onClick={never}>
            {t('support.never')}
          </Button>
          <Button onClick={onClose}>{t('support.no')}</Button>
          <Button variant="primary" icon="star" onClick={yes}>
            {t('support.yes')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
