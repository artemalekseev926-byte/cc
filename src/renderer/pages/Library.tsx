import { useMemo, useState } from 'react';
import { createEmptyTheme } from '../../shared/theme/factory';
import { PRESETS } from '../../shared/theme/presets';
import { slugify } from '../../shared/theme/schema';
import type { ApplyResult, ThemeSummary } from '../../shared/ipc';
import { estimateTheme } from '../../shared/perf/estimator';
import { api, isDesktopApp } from '../app/api';
import { useT, type TFunction } from '../app/i18n';
import { usePrimaryDisplay, useStudio } from '../app/store';
import { DesktopPreview } from '../components/DesktopPreview';
import { RatingBadge } from '../components/PerfMeter';
import { Icon } from '../components/Icon';
import { Button, Empty, Modal, Segmented, Tip } from '../components/ui';

type Filter = 'all' | 'local' | 'builtin';

export function summarizeApply(result: ApplyResult, t: TFunction): string {
  const applied = result.steps.filter((s) => s.status === 'applied').length;
  const skipped = result.steps.filter((s) => s.status === 'skipped').length;
  const failed = result.steps.filter((s) => s.status === 'failed');
  let text = t('apply.summary', { applied, skipped });
  if (failed.length) text += ` ${t('apply.failedList', { list: failed.map((f) => t(f.what)).join(', ') })}`;
  if (result.explorerRestarted) text += ` ${t('apply.explorerRestarted')}`;
  return text;
}

export function useThemeActions() {
  const t = useT();
  const { toast, openInEditor, go } = useStudio();
  return {
    async apply(id: string) {
      try {
        const result = await api.desktop.apply(id);
        toast(result.ok ? 'success' : 'error', summarizeApply(result, t));
      } catch (err) {
        toast('error', String(err));
      }
    },
    async edit(summary: ThemeSummary) {
      if (summary.source === 'local') {
        openInEditor(await api.themes.load(summary.id));
        return;
      }
      const copy = await api.themes.duplicate(summary.id, `${summary.name} (${t('library.copySuffix')})`);
      toast('info', t('library.editingCopy'));
      openInEditor(copy);
    },
    async duplicate(summary: ThemeSummary) {
      await api.themes.duplicate(summary.id, `${summary.name} (${t('library.copySuffix')})`);
      toast('success', t('library.duplicated'));
    },
    async remove(summary: ThemeSummary) {
      if (!window.confirm(t('library.confirmDelete', { name: summary.name }))) return;
      await api.themes.remove(summary.id);
      toast('success', t('library.deleted'));
    },
    perf: (id: string) => go('performance', id),
    share: (id: string) => go('share', id),
    async exportFile(id: string) {
      try {
        const res = await api.themes.exportPackage(id);
        if (res.ok && res.path) {
          toast('success', t('share.exported', { mb: ((res.bytes ?? 0) / 1024 / 1024).toFixed(1) }));
          void api.themes.revealFile(res.path);
        }
      } catch (err) {
        toast('error', String(err));
      }
    },
  };
}

export function Library() {
  const t = useT();
  const { library, desktop, settings } = useStudio();
  const display = usePrimaryDisplay();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return library.filter(
      (s) =>
        (filter === 'all' || s.source === filter) &&
        (!q || s.name.toLowerCase().includes(q) || s.author.toLowerCase().includes(q) || s.tags.some((tag) => tag.toLowerCase().includes(q))),
    );
  }, [library, filter, query]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t('library.title')}</h1>
          <p className="muted">{t('library.subtitle')}</p>
        </div>
        <div className="row">
          {desktop.running && (
            <Button icon="stop" onClick={() => void api.desktop.stop()}>
              {t('library.stopWallpaper')}
            </Button>
          )}
          <Button variant="primary" size="lg" icon="plus" onClick={() => setCreating(true)}>
            {t('library.create')}
          </Button>
        </div>
      </header>

      {settings?.beginnerMode && <Tip>{t('library.tip')}</Tip>}

      <div className="toolbar">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('library.filter.all') },
            { value: 'local', label: t('library.filter.local') },
            { value: 'builtin', label: t('library.filter.builtin') },
          ]}
        />
        <input className="search" placeholder={t('library.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {shown.length === 0 ? (
        <Empty icon="image" title={t('library.empty')}>
          <Button variant="primary" onClick={() => setCreating(true)}>
            {t('library.create')}
          </Button>
        </Empty>
      ) : (
        <div className="grid">
          {shown.map((s) => (
            <ThemeCard key={s.id} summary={s} active={desktop.activeThemeId === s.id} displayWidth={display.width} />
          ))}
        </div>
      )}

      {creating && <NewThemeDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function ThemeCard({ summary, active, displayWidth }: { summary: ThemeSummary; active: boolean; displayWidth: number }) {
  const t = useT();
  const actions = useThemeActions();
  const [hover, setHover] = useState(false);
  const estimate = useMemo(() => estimateTheme(summary.theme), [summary.theme]);
  return (
    <div className={`card theme-card ${active ? 'active' : ''}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="theme-thumb" onDoubleClick={() => void actions.edit(summary)}>
        {summary.previewUrl && !hover ? (
          <img src={summary.previewUrl} alt="" />
        ) : (
          <DesktopPreview theme={summary.theme} displayWidth={displayWidth} paused={!hover} chrome={false} />
        )}
        {active && <span className="badge badge-accent thumb-badge">
            <Icon name="check" size={12} /> {t('library.active')}
          </span>}
        <span className="thumb-source">{t(`library.source.${summary.source}`)}</span>
      </div>
      <div className="theme-meta">
        <div className="theme-title">
          <strong title={summary.name}>{summary.name}</strong>
          <RatingBadge rating={estimate.rating} />
        </div>
        <div className="muted small">{summary.author ? t('library.by', { author: summary.author }) : ' '}</div>
      </div>
      <div className="theme-actions">
        <Button variant="primary" icon="check" onClick={() => void actions.apply(summary.id)}>
          {t('library.apply')}
        </Button>
        <Button icon="pencil" onClick={() => void actions.edit(summary)}>
          {t('library.edit')}
        </Button>
        <div className="menu">
          <Button variant="ghost" icon="more" title={t('library.more')}>
          </Button>
          <div className="menu-items">
            <button type="button" onClick={() => actions.perf(summary.id)}>
              <Icon name="gauge" size={15} /> {t('library.testPerf')}
            </button>
            <button type="button" onClick={() => void actions.duplicate(summary)}>
              ⧉ {t('library.duplicate')}
            </button>
            {summary.source === 'local' && (
              <>
                <button type="button" onClick={() => void actions.exportFile(summary.id)}>
                  <Icon name="package" size={15} /> {t('library.export')}
                </button>
                <button type="button" onClick={() => void api.themes.openFolder(summary.id)}>
                  <Icon name="folder-open" size={15} /> {t('library.openFolder')}
                </button>
                <button type="button" className="danger" onClick={() => void actions.remove(summary)}>
                  <Icon name="trash" size={15} /> {t('library.delete')}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NewThemeDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { openInEditor, toast, settings } = useStudio();
  const display = usePrimaryDisplay();
  const [mode, setMode] = useState<'choose' | 'template'>('choose');

  const fromTemplate = async (id: string, name: string) => {
    const copy = await api.themes.duplicate(id, name);
    onClose();
    openInEditor(copy);
  };

  const blank = async () => {
    const name = t('library.untitled');
    const theme = createEmptyTheme(`${slugify(name)}-${Date.now().toString(36)}`, name, settings?.authorName ?? '');
    await api.themes.save(theme);
    onClose();
    openInEditor(theme);
  };

  const fromMedia = async () => {
    const paths = await api.themes.pickFiles('any');
    if (paths.length === 0) return;
    const result = await api.themes.importArtwork(paths);
    if (!result.theme) {
      toast('error', t('import.nothingUsable'));
      return;
    }
    onClose();
    openInEditor(result.theme);
  };

  return (
    <Modal title={t('new.title')} onClose={onClose} wide>
      {mode === 'choose' ? (
        <div className="choice-grid">
          <button type="button" className="choice" onClick={() => setMode('template')}>
            <Icon name="palette" size={38} strokeWidth={1.4} className="choice-icon" />
            <strong>{t('new.template')}</strong>
            <span className="muted">{t('new.templateDesc')}</span>
          </button>
          <button type="button" className="choice" onClick={() => void fromMedia()} disabled={!isDesktopApp}>
            <Icon name="image-plus" size={38} strokeWidth={1.4} className="choice-icon" />
            <strong>{t('new.fromMedia')}</strong>
            <span className="muted">{t('new.fromMediaDesc')}</span>
          </button>
          <button type="button" className="choice" onClick={() => void blank()}>
            <Icon name="sparkles" size={38} strokeWidth={1.4} className="choice-icon" />
            <strong>{t('new.blank')}</strong>
            <span className="muted">{t('new.blankDesc')}</span>
          </button>
        </div>
      ) : (
        <>
          <Button variant="ghost" icon="arrow-left" onClick={() => setMode('choose')}>
            {t('common.back')}
          </Button>
          <div className="grid grid-small">
            {PRESETS.map(({ theme, blurbKey }) => (
              <button type="button" key={theme.id} className="card template-card" onClick={() => void fromTemplate(theme.id, theme.name)}>
                <DesktopPreview theme={theme} displayWidth={display.width} chrome={false} />
                <strong>{theme.name}</strong>
                <span className="muted small">{t(blurbKey)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
