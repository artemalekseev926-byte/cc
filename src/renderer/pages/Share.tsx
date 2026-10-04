import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExportResult } from '../../shared/ipc';
import type { ClassifiedFile } from '../../shared/sharing/import';
import { THEME_TAGS, canExport, validateForExport, type Check } from '../../shared/sharing/validate';
import type { Theme } from '../../shared/theme/schema';
import { api, isDesktopApp } from '../app/api';
import { useT } from '../app/i18n';
import { usePrimaryDisplay, useStudio } from '../app/store';
import { DesktopPreview } from '../components/DesktopPreview';
import { Button, Empty, Field, Tip } from '../components/ui';

export function Share() {
  const t = useT();
  const { library, focusThemeId } = useStudio();
  const [selectedId, setSelectedId] = useState<string | null>(focusThemeId);
  const localThemes = library.filter((s) => s.source === 'local');

  useEffect(() => {
    if (focusThemeId) setSelectedId(focusThemeId);
  }, [focusThemeId]);

  const selected = localThemes.find((s) => s.id === selectedId) ?? localThemes[0] ?? null;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t('share.title')}</h1>
          <p className="muted">{t('share.subtitle')}</p>
        </div>
      </header>

      <ImportDropZone onImported={(id) => setSelectedId(id)} />

      <section className="section">
        <h2>📦 {t('share.exportTitle')}</h2>
        {localThemes.length === 0 ? (
          <Empty icon="🎨" title={t('share.noLocal')} />
        ) : (
          <div className="publish-layout">
            <div className="publish-list">
              {localThemes.map((s) => (
                <button type="button" key={s.id} className={`publish-item ${s.id === selected?.id ? 'active' : ''}`} onClick={() => setSelectedId(s.id)}>
                  {s.previewUrl ? <img src={s.previewUrl} alt="" /> : <span className="publish-thumb-empty">🖼️</span>}
                  <span>
                    <strong>{s.name}</strong>
                    <span className="muted small">{s.author || ' '}</span>
                  </span>
                </button>
              ))}
            </div>
            {selected && <ExportForm key={selected.id} theme={selected.theme} previewUrl={selected.previewUrl} />}
          </div>
        )}
      </section>
    </div>
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
      setFiles(result.files.filter((f) => f.kind !== 'theme'));
      if (result.theme) {
        toast('success', t('import.done', { name: result.theme.name }));
        onImported(result.theme.id);
        setTitle('');
      } else {
        toast('error', t('import.nothingUsable'));
      }
    } catch (err) {
      toast('error', t(errorKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="section">
      <h2>📥 {t('import.title')}</h2>
      <div
        className={`dropzone ${over ? 'over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
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

export function errorKey(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const match = /(import\.package\.\w+)/.exec(msg);
  return match ? match[1] : 'import.package.invalid';
}

const CHECK_ICON: Record<Check['level'], string> = { ok: '✅', warning: '⚠️', error: '❌' };

function ExportForm({ theme, previewUrl }: { theme: Theme; previewUrl?: string }) {
  const t = useT();
  const { toast, openInEditor } = useStudio();
  const display = usePrimaryDisplay();
  const [title, setTitle] = useState(theme.name);
  const [description, setDescription] = useState(theme.description);
  const [tags, setTags] = useState<string[]>(theme.tags.filter((x) => (THEME_TAGS as readonly string[]).includes(x)));
  const [contentBytes, setContentBytes] = useState(0);
  const [previewBytes, setPreviewBytes] = useState<number | null>(previewUrl ? 1 : null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<ExportResult | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.themes.folderSize(theme.id).then(setContentBytes);
  }, [theme.id]);

  const checks = useMemo(
    () => validateForExport({ theme, title, description, tags, previewBytes, contentBytes, display }),
    [theme, title, description, tags, previewBytes, contentBytes, display],
  );

  const capture = async () => {
    const el = previewRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const res = await api.themes.capturePreview(theme.id, { x: r.left, y: r.top, width: r.width, height: r.height });
    setPreviewBytes(res.bytes);
    return res;
  };

  const exportFile = async () => {
    setBusy(true);
    try {
      await api.themes.save({ ...theme, name: title.trim(), description, tags });
      if (previewBytes === null && isDesktopApp) await capture();
      const res = await api.themes.exportPackage(theme.id);
      if (res.ok) {
        setLast(res);
        toast('success', t('share.exported', { mb: ((res.bytes ?? 0) / 1024 / 1024).toFixed(1) }));
      }
    } catch (err) {
      toast('error', String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="publish-form">
      <div className="publish-preview">
        <DesktopPreview ref={previewRef} theme={theme} displayWidth={display.width} />
        <div className="row">
          <Button size="sm" icon="📸" onClick={async () => {
              await capture();
              toast('success', t('editor.previewSaved'));
            }} disabled={!isDesktopApp}>
            {t('share.capturePreview')}
          </Button>
          <Button size="sm" icon="✏️" onClick={async () => openInEditor(await api.themes.load(theme.id))}>
            {t('library.edit')}
          </Button>
        </div>
      </div>
      <div className="stack">
        <Field label={t('info.name')}>
          <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label={t('info.description')}>
          <textarea rows={4} value={description} maxLength={4000} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label={t('info.tags')}>
          <div className="tag-picker">
            {THEME_TAGS.map((tag) => (
              <button type="button" key={tag} className={`tag ${tags.includes(tag) ? 'on' : ''}`} onClick={() => setTags(tags.includes(tag) ? tags.filter((x) => x !== tag) : [...tags, tag])}>
                {t(`tag.${tag}`)}
              </button>
            ))}
          </div>
        </Field>

        <div className="checklist">
          <strong>{t('share.checklist')}</strong>
          {checks.map((c) => (
            <div key={c.id} className={`check check-${c.level}`}>
              <span>{CHECK_ICON[c.level]}</span>
              <span>{t(c.key, c.params)}</span>
            </div>
          ))}
        </div>

        <Button variant="primary" size="lg" icon="💾" disabled={!canExport(checks) || busy || !isDesktopApp} onClick={() => void exportFile()}>
          {busy ? t('common.working') : t('share.export')}
        </Button>
        {last?.path && (
          <div className="row">
            <span className="muted small mono">{last.path}</span>
            <Button size="sm" icon="📂" onClick={() => void api.themes.revealFile(last.path!)}>
              {t('share.showInFolder')}
            </Button>
          </div>
        )}
        <p className="muted small">{t('share.howToShare')}</p>
      </div>
    </div>
  );
}
