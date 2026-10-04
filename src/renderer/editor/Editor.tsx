/**
 * The editor: tools on the left, a live desktop preview in the middle,
 * properties on the right, layers and a live resource meter at the bottom.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { estimateTheme } from '../../shared/perf/estimator';
import { api, isDesktopApp } from '../app/api';
import { useT } from '../app/i18n';
import { extractAccent } from '../app/media';
import { useEditingTheme, usePrimaryDisplay, useStudio } from '../app/store';
import { DesktopPreview } from '../components/DesktopPreview';
import { PerfMeter } from '../components/PerfMeter';
import { Button, Empty, Tip } from '../components/ui';
import { summarizeApply } from '../pages/Library';
import { importMediaFiles } from './actions';
import { Inspector } from './Inspector';
import { LayerList } from './LayerList';
import { ToolPalette } from './ToolPalette';

export function Editor() {
  const t = useT();
  const theme = useEditingTheme();
  const display = usePrimaryDisplay();
  const { editor, undo, redo, saveEditor, toast, go, showSection, select, settings, edit } = useStudio();
  const previewRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const estimate = useMemo(() => (theme ? estimateTheme(theme, display) : null), [theme, display]);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) / Ctrl+S / Delete
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      } else if (e.key === 'Delete' && !typing && editor.selectedLayerId) {
        const id = editor.selectedLayerId;
        edit((d) => {
          d.wallpaper.layers = d.wallpaper.layers.filter((l) => l.id !== id);
        });
        select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Auto accent: keep the accent in sync with the wallpaper when enabled.
  const mediaSignature = theme
    ? theme.wallpaper.layers
        .filter((l) => l.visible)
        .map((l) => (l.type === 'image' || l.type === 'video' ? l.asset : l.type === 'shader' ? l.colorB : l.type === 'gradient' ? l.colors.join() : ''))
        .join('|')
    : '';
  useEffect(() => {
    if (!theme?.colors.autoAccentFromWallpaper) return;
    let cancelled = false;
    void extractAccent(theme).then((accent) => {
      if (!cancelled && accent !== theme.colors.accent) edit((d) => (d.colors.accent = accent), 'auto-accent');
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme?.colors.autoAccentFromWallpaper, mediaSignature]);

  if (!theme || !estimate) {
    return (
      <div className="page">
        <Empty icon="✏️" title={t('editor.nothingOpen')}>
          <Button variant="primary" onClick={() => go('library')}>
            {t('editor.openLibrary')}
          </Button>
        </Empty>
      </div>
    );
  }

  async function save(): Promise<boolean> {
    const ok = await saveEditor();
    if (ok) {
      toast('success', t('editor.saved'));
      void capturePreview(true);
    }
    return ok;
  }

  async function capturePreview(silent = false) {
    const el = previewRef.current;
    const current = useStudio.getState().editor.history?.present;
    if (!el || !current || !isDesktopApp) return;
    const r = el.getBoundingClientRect();
    try {
      await api.themes.capturePreview(current.id, { x: r.left, y: r.top, width: r.width, height: r.height });
      if (!silent) toast('success', t('editor.previewSaved'));
    } catch (err) {
      if (!silent) toast('error', String(err));
    }
  }

  const apply = async () => {
    setBusy('apply');
    if (editor.dirty && !(await saveEditor())) {
      setBusy(null);
      return;
    }
    void capturePreview(true);
    const result = await api.desktop.apply(theme.id);
    toast(result.ok ? 'success' : 'error', summarizeApply(result, t));
    setBusy(null);
  };

  const tryLive = async () => {
    await api.desktop.previewLive(theme, 10);
    toast('info', t('editor.tryingLive'));
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const paths = [...e.dataTransfer.files].map((f) => api.themes.pathForFile(f)).filter(Boolean);
    if (paths.length) await importMediaFiles(paths, t);
  };

  const history = editor.history!;
  return (
    <div className="editor">
      <header className="editor-bar">
        <Button variant="ghost" icon="←" onClick={() => go('library')}>
          {t('nav.library')}
        </Button>
        <input
          className="editor-title"
          value={theme.name}
          maxLength={80}
          onChange={(e) => edit((d) => (d.name = e.target.value || ' '), 'name')}
          aria-label={t('info.name')}
        />
        {editor.dirty && <span className="dirty-dot" title={t('editor.unsaved')}>●</span>}
        <div className="spacer" />
        <Button variant="ghost" icon="↶" onClick={undo} disabled={history.past.length === 0} title={`${t('editor.undo')} (Ctrl+Z)`} />
        <Button variant="ghost" icon="↷" onClick={redo} disabled={history.future.length === 0} title={`${t('editor.redo')} (Ctrl+Y)`} />
        <Button icon={paused ? '▶' : '⏸'} onClick={() => setPaused(!paused)} title={t('editor.toggleAnimation')}>
          {paused ? t('editor.play') : t('editor.pause')}
        </Button>
        <Button icon="📸" onClick={() => void capturePreview()} disabled={!isDesktopApp} title={t('editor.capturePreviewHint')}>
          {t('editor.capturePreview')}
        </Button>
        <Button icon="👀" onClick={() => void tryLive()} title={t('editor.tryLiveHint')}>
          {t('editor.tryLive')}
        </Button>
        <Button icon="💾" onClick={() => void save()} disabled={editor.saving} title="Ctrl+S">
          {t('editor.save')}
        </Button>
        <Button variant="primary" icon="✔" onClick={() => void apply()} disabled={busy === 'apply'}>
          {t('editor.apply')}
        </Button>
      </header>

      <div className="editor-body">
        <ToolPalette />
        <main
          className={`editor-canvas ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => void onDrop(e)}
        >
          {settings?.beginnerMode && theme.wallpaper.layers.length <= 1 && <Tip>{t('editor.beginnerTip')}</Tip>}
          <div className="preview-frame">
            <DesktopPreview ref={previewRef} theme={theme} displayWidth={display.width} aspect={display.width / display.height} paused={paused} highlightLayerId={null} />
            {dragOver && <div className="drop-overlay">{t('editor.dropHere')}</div>}
          </div>
          <div className="canvas-shortcuts">
            <button type="button" onClick={() => showSection('colors')}>🎨 {t('section.colors')}</button>
            <button type="button" onClick={() => showSection('windows')}>🪟 {t('section.windows')}</button>
            <button type="button" onClick={() => showSection('taskbar')}>📏 {t('section.taskbar')}</button>
            <button type="button" onClick={() => showSection('desktop')}>🗂️ {t('section.desktop')}</button>
          </div>
        </main>
        <Inspector estimate={estimate} />
      </div>

      <footer className="editor-footer">
        <LayerList costs={estimate.layers} />
        <div className="footer-meter">
          <PerfMeter estimate={estimate} onClick={() => showSection('performance')} />
          <span className="muted small">{t('perf.estimateNote', { w: display.width, h: display.height, fps: theme.wallpaper.fpsLimit })}</span>
        </div>
      </footer>
    </div>
  );
}
