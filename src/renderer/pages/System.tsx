import { useCallback, useEffect, useState } from 'react';
import { APP_CATALOG, type AppEntry, type AppsStatus } from '../../shared/system/apps';
import { TWEAKS, TWEAK_GROUPS, type TweakId, type TweakState, type TweakValue } from '../../shared/system/tweaks';
import { api, isDesktopApp } from '../app/api';
import { useT } from '../app/i18n';
import { useStudio } from '../app/store';
import { Icon, isIconName, type IconName } from '../components/Icon';
import { Button, Segmented, Tip, Toggle } from '../components/ui';

const GROUP_ICONS: Record<(typeof TWEAK_GROUPS)[number], IconName> = {
  explorer: 'folder-open',
  taskbar: 'panel-bottom',
  input: 'zap',
  gaming: 'gamepad',
};

export function SystemPage() {
  const t = useT();
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t('system.title')}</h1>
          <p className="muted">{t('system.subtitle')}</p>
        </div>
      </header>
      <Tweaks />
      <AppsCatalog />
    </div>
  );
}

function Tweaks() {
  const t = useT();
  const { caps, toast } = useStudio();
  const [states, setStates] = useState<TweakState[] | null>(null);
  const [busy, setBusy] = useState<TweakId | null>(null);
  const [restartNeeded, setRestartNeeded] = useState(false);

  const load = useCallback(async () => setStates(await api.system.tweaks()), []);
  useEffect(() => {
    void load();
  }, [load]);

  const change = async (id: TweakId, value: TweakValue) => {
    setBusy(id);
    setStates((prev) => prev?.map((s) => (s.id === id ? { ...s, value } : s)) ?? null);
    const res = await api.system.setTweak(id, value);
    setBusy(null);
    if (!res.ok) {
      toast('error', `${t(`tweak.${id}`)}: ${t(res.error ?? 'common.error')}`);
      void load();
      return;
    }
    if (res.restartExplorer) setRestartNeeded(true);
  };

  const restart = async () => {
    await api.system.restartExplorer();
    setRestartNeeded(false);
    toast('success', t('system.explorerRestarted'));
  };

  const windows = caps?.os === 'windows';
  return (
    <section className="section">
      <h2 className="with-icon">
        <Icon name="monitor-cog" size={18} /> {t('system.tweaksTitle')}
      </h2>
      {!windows && <Tip>{t('caps.windowsOnly')}</Tip>}
      {restartNeeded && (
        <div className="restart-banner">
          <Icon name="refresh" size={16} />
          <span>{t('system.restartNeeded')}</span>
          <Button size="sm" variant="primary" onClick={() => void restart()}>
            {t('system.restartExplorer')}
          </Button>
        </div>
      )}
      <div className="tweak-groups">
        {TWEAK_GROUPS.map((group) => (
          <div key={group} className="card pad tweak-group">
            <h3 className="with-icon">
              <Icon name={GROUP_ICONS[group]} size={16} /> {t(`tweakGroup.${group}`)}
            </h3>
            {TWEAKS.filter((d) => d.group === group).map((def) => {
              const state = states?.find((s) => s.id === def.id);
              const disabled = !state?.supported || busy === def.id || !isDesktopApp;
              return (
                <div key={def.id} className={`tweak ${state && !state.supported ? 'tweak-unsupported' : ''}`}>
                  <Icon name={isIconName(def.icon) ? def.icon : 'settings'} size={18} className="tweak-icon" />
                  <div className="tweak-text">
                    <strong>{t(`tweak.${def.id}`)}</strong>
                    <span className="muted small">
                      {t(`tweak.${def.id}.desc`)}
                      {def.restartExplorer && ` ${t('system.needsRestartNote')}`}
                      {state && !state.supported && ` ${t(def.windows11Only ? 'caps.needsWin11' : 'caps.windowsOnly')}`}
                    </span>
                  </div>
                  {def.kind === 'toggle' ? (
                    <Toggle checked={state?.value === true} disabled={disabled} onChange={(v) => void change(def.id, v)} />
                  ) : (
                    <Segmented
                      value={String(state?.value ?? '')}
                      disabled={disabled}
                      onChange={(v) => void change(def.id, v)}
                      options={(def.options ?? []).map((o) => ({ value: o, label: t(`tweak.${def.id}.${o}`) }))}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function AppsCatalog() {
  const t = useT();
  const toast = useStudio((s) => s.toast);
  const [status, setStatus] = useState<AppsStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus(await api.system.appsStatus());
    setLoading(false);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const act = async (app: AppEntry, action: 'install' | 'uninstall') => {
    setWorking(app.id);
    const res = action === 'install' ? await api.system.installApp(app.id) : await api.system.uninstallApp(app.id);
    setWorking(null);
    if (res.ok) {
      toast('success', t(action === 'install' ? 'apps.installed' : 'apps.removed', { name: app.name }));
      setStatus((prev) =>
        prev ? { ...prev, installed: action === 'install' ? [...new Set([...prev.installed, app.id])] : prev.installed.filter((id) => id !== app.id) } : prev,
      );
    } else {
      toast('error', `${app.name}: ${t(res.error ?? 'common.error')}`);
    }
  };

  return (
    <section className="section">
      <div className="row between">
        <h2 className="with-icon">
          <Icon name="store" size={18} /> {t('apps.title')}
        </h2>
        <Button size="sm" variant="ghost" icon="refresh" onClick={() => void load()} disabled={loading}>
          {t('apps.refresh')}
        </Button>
      </div>
      <p className="muted">{t('apps.subtitle')}</p>
      {!loading && status && !status.wingetAvailable && <Tip>{t('apps.noWinget')}</Tip>}
      <div className="apps-grid">
        {APP_CATALOG.map((app) => {
          const installed = status?.installed.includes(app.id) ?? false;
          const isWorking = working === app.id;
          return (
            <div key={app.id} className="card app-card">
              <div className="app-head">
                <span className="app-icon">
                  <Icon name={isIconName(app.icon) ? app.icon : 'package'} size={22} />
                </span>
                <div className="app-title">
                  <strong>{app.name}</strong>
                  <span className="muted small">{t(`apps.category.${app.category}`)}</span>
                </div>
                {installed && (
                  <span className="badge badge-ok">
                    <Icon name="check" size={12} /> {t('apps.isInstalled')}
                  </span>
                )}
              </div>
              <p className="small app-desc">{t(`app.${app.id}`)}</p>
              {app.advanced && <p className="small level-warning">{t('apps.advanced')}</p>}
              <div className="row">
                {installed ? (
                  <Button size="sm" icon="trash" disabled={!!working || !status?.wingetAvailable} onClick={() => void act(app, 'uninstall')}>
                    {isWorking ? t('common.working') : t('apps.uninstall')}
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" icon="download" disabled={!!working || loading || !status?.wingetAvailable} onClick={() => void act(app, 'install')}>
                    {isWorking ? t('apps.installing') : t('apps.install')}
                  </Button>
                )}
                <Button size="sm" variant="ghost" icon="external" onClick={() => window.open(app.homepage, '_blank')}>
                  {t('apps.site')}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <Tip>{t('apps.tip')}</Tip>
    </section>
  );
}
