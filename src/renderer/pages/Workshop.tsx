/**
 * Steam Workshop: artists drop their artwork, get a ready theme, check it
 * against a clear checklist and publish — plus the list of subscribed items.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PublishProgress, PublishRequest, SteamStatus, SubscribedItem } from '../../shared/ipc';
import type { ClassifiedFile } from '../../shared/workshop/import';
import { WORKSHOP_TAGS, canPublish, validateForPublish, type Check } from '../../shared/workshop/validate';
import { api, isDesktopApp } from '../app/api';
import { useT } from '../app/i18n';
import { usePrimaryDisplay, useStudio } from '../app/store';
import { DesktopPreview } from '../components/DesktopPreview';
import { Button, Empty, Field, ProgressBar, Segmented, Tip } from '../components/ui';
import type { Theme } from '../../shared/theme/schema';

export function Workshop() {
  const t = useT();
  const [steam, setSteam] = useState<SteamStatus | null>(null);
  const [subscribed, setSubscribed] = useState<SubscribedItem[]>([]);
  const { library, focusThemeId } = useStudio();
  const [selectedId, setSelectedId] = useState<string | null>(focusThemeId);
  const localThemes = library.filter((s) => s.source === 'local');

  useEffect(() => {
    void api.steam.status().then(setSteam);
    void api.steam.subscribed().then(setSubscribed);
  }, []);
  useEffect(() => {
    if (focusThemeId) setSelectedId(focusThemeId);
  }, [focusThemeId]);

  const selected = localThemes.find((s) => s.id === selectedId) ?? localThemes[0] ?? null;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t('workshop.title')}</h1>
          <p className="muted">{t('workshop.subtitle')}</p>
        </div>
        <SteamBadge status={steam} />
      </header>

      <ImportDropZone onImported={(id) => setSelectedId(id)} />

      <section className="section">
        <h2>☁️ {t('workshop.publishTitle')}</h2>
        {localThemes.length === 0 ? (
          <Empty icon="🎨" title={t('workshop.noLocal')} />
        ) : (
          <div className="publish-layout">
            <div className="publish-list">
              {localThemes.map((s) => (
                <button type="button" key={s.id} className={`publish-item ${s.id === selected?.id ? 'active' : ''}`} onClick={() => setSelectedId(s.id)}>
                  {s.previewUrl ? <img src={s.previewUrl} alt="" /> : <span className="publish-thumb-empty">🖼️</span>}
                  <span>
                    <strong>{s.name}</strong>
                    <span className="muted small">{s.workshopId ? t('workshop.published') : t('workshop.notPublished')}</span>
                  </span>
                </button>
              ))}
            </div>
            {selected ? <PublishForm key={selected.id} theme={selected.theme} previewUrl={selected.previewUrl} steam={steam} /> : <div className="muted pad">{t('workshop.pickTheme')}</div>}
          </div>
        )}
      </section>

      <section className="section">
        <h2>📥 {t('workshop.subscribedTitle')}</h2>
        {!steam?.available ? (
          <p className="muted">{t('workshop.subscribedNeedsSteam')}</p>
        ) : subscribed.length === 0 ? (
          <p className="muted">{t('workshop.noSubscribed')}</p>
        ) : (
          <ul className="subscribed">
            {subscribed.map((item) => (
              <li key={item.workshopId}>
                <span>{item.title}</span>
                <span className="muted small">{item.installed ? t('workshop.installed') : t('workshop.downloading')}</span>
                {item.themeId && (
                  <Button size="sm" onClick={() => void api.desktop.apply(item.themeId!)}>
                    {t('library.apply')}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => void api.steam.openItem(item.workshopId)}>
                  🔗
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SteamBadge({ status }: { status: SteamStatus | null }) {
  const t = useT();
  if (!status) return null;
  return status.available ? (
    <span className="badge badge-ok">🟢 {t('steam.connected', { name: status.userName ?? 'Steam' })}</span>
  ) : (
    <span className="badge badge-warn" title={t(status.reason ?? 'steam.notRunning')}>
      🟠 {t(status.reason ?? 'steam.notRunning')}
    </span>
  );
}

function ImportDropZone({ onImported }: { onImported: (themeId: string) => void }) {
  const t = useT();
  const toast = useStudio((s) => s.toast);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<ClassifiedFile[]>([]);
  const [title, setTitle] = useState('');

  const run = async (paths: string[]) => {
    if (paths.length === 0) return;
    setBusy(true);
    try {
      const result = await api.themes.importArtwork(paths, title || undefined);
      setFiles(result.files);
      if (result.theme) {
        toast('success', t('import.done', { name: result.theme.name }));
        onImported(result.theme.id);
        setTitle('');
      } else {
        toast('error', t('import.nothingUsable'));
      }
    } catch (err) {
      toast('error', String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section">
      <h2>🎨 {t('import.title')}</h2>
      <div
        className={`dropzone ${over ? 'over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void run([...e.dataTransfer.files].map((f) => api.themes.pathForFile(f)).filter(Boolean));
        }}
      >
        <div className="dropzone-icon">⬇️</div>
        <strong>{t('import.drop')}</strong>
        <span className="muted">{t('import.formats')}</span>
        <div className="row">
          <input placeholder={t('import.titlePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} />
          <Button variant="primary" disabled={busy || !isDesktopApp} onClick={async () => void run(await api.themes.pickFiles('any'))}>
            {busy ? t('common.working') : t('import.browse')}
          </Button>
        </div>
      </div>
      {files.length > 0 && (
        <ul className="import-results">
          {files.map((f) => (
            <li key={f.path} className={f.problem ? 'bad' : f.warning ? 'warn' : 'ok'}>
              <span>{f.problem ? '❌' : f.warning ? '⚠️' : '✅'}</span>
              <span className="mono small">{f.name}</span>
              <span className="muted small">{f.problem ? t(f.problem) : f.warning ? t(f.warning) : t(`import.kind.${f.kind}`)}</span>
            </li>
          ))}
        </ul>
      )}
      <Tip>{t('import.tip')}</Tip>
    </section>
  );
}

const CHECK_ICON: Record<Check['level'], string> = { ok: '✅', warning: '⚠️', error: '❌' };

function PublishForm({ theme, previewUrl, steam }: { theme: Theme; previewUrl?: string; steam: SteamStatus | null }) {
  const t = useT();
  const { toast, openInEditor } = useStudio();
  const display = usePrimaryDisplay();
  const [title, setTitle] = useState(theme.name);
  const [description, setDescription] = useState(theme.description);
  const [tags, setTags] = useState<string[]>(theme.tags.filter((x) => (WORKSHOP_TAGS as readonly string[]).includes(x)));
  const [visibility, setVisibility] = useState<PublishRequest['visibility']>('public');
  const [changeNote, setChangeNote] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [contentBytes, setContentBytes] = useState(0);
  const [previewBytes, setPreviewBytes] = useState<number | null>(previewUrl ? 1 : null);
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.themes.folderSize(theme.id).then(setContentBytes);
  }, [theme.id]);
  useEffect(() => api.steam.onPublishProgress(setProgress), []);

  const checks = useMemo(
    () => validateForPublish({ theme, title, description, tags, previewBytes, contentBytes, acceptedTerms: accepted, display }),
    [theme, title, description, tags, previewBytes, contentBytes, accepted, display],
  );
  const ready = canPublish(checks) && !!steam?.available;

  const capture = async () => {
    const el = previewRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const res = await api.themes.capturePreview(theme.id, { x: r.left, y: r.top, width: r.width, height: r.height });
    setPreviewBytes(res.bytes);
    toast('success', t('editor.previewSaved'));
  };

  const publish = async () => {
    setProgress({ stage: 'preparing', progress: 0 });
    if (previewBytes === null) await capture();
    const result = await api.steam.publish({ themeId: theme.id, title, description, changeNote, tags, visibility });
    if (result.ok) {
      toast('success', t('workshop.publishedOk'));
      if (result.workshopId) void api.steam.openItem(result.workshopId);
    } else {
      toast('error', t(result.error ?? 'common.error'));
      setProgress(null);
    }
  };

  return (
    <div className="publish-form">
      <div className="publish-preview">
        <DesktopPreview ref={previewRef} theme={theme} displayWidth={display.width} />
        <div className="row">
          <Button size="sm" icon="📸" onClick={() => void capture()} disabled={!isDesktopApp}>
            {t('workshop.capturePreview')}
          </Button>
          <Button size="sm" icon="✏️" onClick={async () => openInEditor(await api.themes.load(theme.id))}>
            {t('library.edit')}
          </Button>
        </div>
      </div>
      <div className="stack">
        <Field label={t('workshop.itemTitle')}>
          <input value={title} maxLength={128} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={t('workshop.description')} hint={t('workshop.descriptionHint')}>
          <textarea rows={5} value={description} maxLength={8000} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label={t('info.tags')}>
          <div className="tag-picker">
            {WORKSHOP_TAGS.map((tag) => (
              <button type="button" key={tag} className={`tag ${tags.includes(tag) ? 'on' : ''}`} onClick={() => setTags(tags.includes(tag) ? tags.filter((x) => x !== tag) : [...tags, tag])}>
                {t(`tag.${tag}`)}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('workshop.visibility')}>
          <Segmented
            value={visibility}
            onChange={setVisibility}
            options={[
              { value: 'public', label: t('workshop.vis.public') },
              { value: 'friends', label: t('workshop.vis.friends') },
              { value: 'unlisted', label: t('workshop.vis.unlisted') },
              { value: 'private', label: t('workshop.vis.private') },
            ]}
          />
        </Field>
        {theme.workshopId && (
          <Field label={t('workshop.changeNote')}>
            <input value={changeNote} onChange={(e) => setChangeNote(e.target.value)} placeholder={t('workshop.changeNotePlaceholder')} />
          </Field>
        )}
        <label className="checkbox">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          <span>{t('workshop.terms')}</span>
        </label>

        <div className="checklist">
          <strong>{t('workshop.checklist')}</strong>
          {checks.map((c) => (
            <div key={c.id} className={`check check-${c.level}`}>
              <span>{CHECK_ICON[c.level]}</span>
              <span>{t(c.key, c.params)}</span>
            </div>
          ))}
        </div>

        {progress && progress.stage !== 'error' && (
          <div className="stack-sm">
            <span className="small">{t(`publish.stage.${progress.stage}`)}</span>
            <ProgressBar value={progress.stage === 'done' ? 1 : progress.progress} tone={progress.stage === 'done' ? 'ok' : 'accent'} />
          </div>
        )}

        <Button variant="primary" size="lg" icon="☁️" disabled={!ready || (!!progress && progress.stage !== 'done')} onClick={() => void publish()}>
          {theme.workshopId ? t('workshop.update') : t('workshop.publish')}
        </Button>
        {!steam?.available && <p className="muted small">{t('workshop.needsSteam')}</p>}
      </div>
    </div>
  );
}
