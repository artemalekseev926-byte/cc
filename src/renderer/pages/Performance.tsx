import { useEffect, useMemo, useState } from 'react';
import { estimateTheme, type Estimate } from '../../shared/perf/estimator';
import type { MeasuredReport } from '../../shared/perf/measure';
import type { PerfProgress } from '../../shared/ipc';
import type { Theme } from '../../shared/theme/schema';
import { api } from '../app/api';
import { useT } from '../app/i18n';
import { usePrimaryDisplay, useStudio } from '../app/store';
import { DesktopPreview } from '../components/DesktopPreview';
import { RatingBadge } from '../components/PerfMeter';
import { Button, Empty, ProgressBar, Segmented, Tip } from '../components/ui';
import { FIXABLE, applyRecommendation } from '../editor/Inspector';
import { LayerIcon } from '../editor/LayerList';
import { Icon } from '../components/Icon';

function Bar({ label, value, max, unit, hint }: { label: string; value: number; max: number; unit: string; hint?: string }) {
  const ratio = value / max;
  const tone = ratio < 0.35 ? 'ok' : ratio < 0.7 ? 'warn' : 'bad';
  return (
    <div className="metric" title={hint}>
      <div className="metric-head">
        <span>{label}</span>
        <b>
          {value}
          {unit}
        </b>
      </div>
      <ProgressBar value={ratio} tone={tone} />
    </div>
  );
}

export function Performance() {
  const t = useT();
  const { library, focusThemeId, go, desktop } = useStudio();
  const editingId = useStudio((s) => s.editor.history?.present.id ?? null);
  const [themeId, setThemeId] = useState<string | null>(focusThemeId ?? editingId ?? desktop.activeThemeId ?? library[0]?.id ?? null);
  useEffect(() => {
    if (focusThemeId) setThemeId(focusThemeId);
  }, [focusThemeId]);
  useEffect(() => {
    if (!themeId && library[0]) setThemeId(library[0].id);
  }, [library, themeId]);
  const summary = library.find((s) => s.id === themeId) ?? null;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{t('perf.title')}</h1>
          <p className="muted">{t('perf.subtitle')}</p>
        </div>
        <select value={themeId ?? ''} onChange={(e) => setThemeId(e.target.value)} className="theme-select">
          {library.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </header>
      {summary ? (
        <PerformanceReport key={summary.id} theme={summary.theme} editable={summary.source === 'local'} />
      ) : (
        <Empty icon="gauge" title={t('perf.noTheme')}>
          <Button onClick={() => go('library')}>{t('nav.library')}</Button>
        </Empty>
      )}
    </div>
  );
}

function PerformanceReport({ theme: initial, editable }: { theme: Theme; editable: boolean }) {
  const t = useT();
  const display = usePrimaryDisplay();
  const toast = useStudio((s) => s.toast);
  const [theme, setTheme] = useState(initial);
  const [resolution, setResolution] = useState<'native' | '1080' | '1440' | '2160'>('native');
  const [measured, setMeasured] = useState<MeasuredReport | null>(null);
  const [progress, setProgress] = useState<PerfProgress | null>(null);

  const target = useMemo(() => {
    const presets = { '1080': [1920, 1080], '1440': [2560, 1440], '2160': [3840, 2160] } as const;
    return resolution === 'native' ? display : { width: presets[resolution][0], height: presets[resolution][1], count: 1 };
  }, [resolution, display]);
  const estimate: Estimate = useMemo(() => estimateTheme(theme, target), [theme, target]);

  useEffect(() => api.perf.onProgress(setProgress), []);

  const runTest = async () => {
    setMeasured(null);
    setProgress({ phase: 'starting', progress: 0 });
    try {
      setMeasured(await api.perf.probe(theme, 8));
    } catch (err) {
      toast('error', String(err));
    } finally {
      setProgress(null);
    }
  };

  const fix = async (key: string, layerId?: string) => {
    const draft = structuredClone(theme);
    applyRecommendation(draft, key, layerId);
    setTheme(draft);
    setMeasured(null);
    if (editable) {
      await api.themes.save(draft);
      toast('success', t('perf.fixed'));
    }
  };

  const maxLayer = Math.max(1, ...estimate.layers.map((l) => l.cpu + l.gpu));

  return (
    <div className="perf-layout">
      <div className="stack">
        <div className="card pad">
          <div className="row between">
            <h2>{t('perf.estimate')}</h2>
            <RatingBadge rating={estimate.rating} />
          </div>
          <p className="muted small">{t(`rating.${estimate.rating}.desc`)}</p>
          <div className="row">
            <span className="muted small">{t('perf.resolution')}</span>
            <Segmented
              value={resolution}
              onChange={setResolution}
              options={[
                { value: 'native', label: t('perf.myScreen', { w: display.width, h: display.height }) },
                { value: '1080', label: '1080p' },
                { value: '1440', label: '1440p' },
                { value: '2160', label: '4K' },
              ]}
            />
          </div>
          <div className="metrics">
            <Bar label={t('perf.cpu')} value={estimate.total.cpu} max={25} unit="%" hint={t('perf.cpuHint')} />
            <Bar label={t('perf.gpu')} value={estimate.total.gpu} max={40} unit="%" hint={t('perf.gpuHint')} />
            <Bar label={t('perf.ram')} value={estimate.total.ram} max={1024} unit=" MB" hint={t('perf.ramHint')} />
            <Bar label={t('perf.vram')} value={estimate.total.vram} max={1024} unit=" MB" hint={t('perf.vramHint')} />
          </div>
          <p className="small">
            {t('perf.scoreLine', { score: estimate.score, watts: estimate.extraWatts })} · {t('perf.fpsLine', { fps: theme.wallpaper.fpsLimit })}
          </p>
        </div>

        <div className="card pad">
          <h2>{t('perf.byLayer')}</h2>
          {estimate.layers.map((l) => (
            <div key={l.layerId} className="layer-cost-row">
              <span>
                <LayerIcon type={l.layerType} size={14} /> {l.layerName}
              </span>
              <div className="layer-cost-bar">
                <div style={{ width: `${((l.cpu + l.gpu) / maxLayer) * 100}%` }} />
              </div>
              <span className="muted small">
                CPU {l.cpu}% · GPU {l.gpu}% · {l.ram} MB
              </span>
            </div>
          ))}
        </div>

        {estimate.recommendations.length > 0 && (
          <div className="card pad">
            <h2 className="with-icon">
              <Icon name="lightbulb" size={18} /> {t('perf.recommendations')}
            </h2>
            {estimate.recommendations.map((r, i) => (
              <div key={i} className="rec">
                <span>
                  {t(r.key, r.params)} {r.savingPercent > 0 && <span className="badge badge-ok">−{r.savingPercent}%</span>}
                </span>
                {FIXABLE.has(r.key) && (
                  <Button size="sm" onClick={() => void fix(r.key, r.layerId)}>
                    {t('perf.fix')}
                  </Button>
                )}
              </div>
            ))}
            {!editable && <p className="muted small">{t('perf.readOnlyFix')}</p>}
          </div>
        )}
      </div>

      <div className="stack">
        <div className="card pad">
          <DesktopPreview theme={theme} displayWidth={display.width} chrome={false} />
        </div>
        <div className="card pad">
          <div className="row between">
            <h2>{t('perf.realTest')}</h2>
            <Button variant="primary" icon="play" onClick={() => void runTest()} disabled={!!progress}>
              {measured ? t('perf.runAgain') : t('perf.runTest')}
            </Button>
          </div>
          <p className="muted small">{t('perf.realTestDesc')}</p>
          {progress && (
            <div className="stack-sm">
              <span className="small">{t(`perf.phase.${progress.phase}`)}</span>
              <ProgressBar value={progress.progress} />
            </div>
          )}
          {measured && <MeasuredView report={measured} estimate={estimate} />}
        </div>
        <Tip>{t('perf.tip')}</Tip>
      </div>
    </div>
  );
}

function MeasuredView({ report, estimate }: { report: MeasuredReport; estimate: Estimate }) {
  const t = useT();
  return (
    <div className="stack">
      <div className="row">
        <RatingBadge rating={report.rating} />
        {report.struggling && <span className="badge badge-bad">{t('perf.struggling', { fps: report.frames.avgFps, target: report.targetFps })}</span>}
      </div>
      <table className="measure-table">
        <thead>
          <tr>
            <th />
            <th>{t('perf.estimated')}</th>
            <th>{t('perf.measured')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{t('perf.cpuCore')}</td>
            <td>~{estimate.total.cpu}%</td>
            <td>
              <b>{report.cpu.avg}%</b> <span className="muted small">({t('perf.peak')} {report.cpu.peak}%)</span>
            </td>
          </tr>
          <tr>
            <td>{t('perf.cpuMachine')}</td>
            <td>—</td>
            <td>
              <b>{report.cpuOfMachine}%</b>
            </td>
          </tr>
          <tr>
            <td>{t('perf.gpuDriver')}</td>
            <td>~{estimate.total.gpu}%</td>
            <td>
              <b>{report.gpuProcessCpu.avg}%</b>
            </td>
          </tr>
          <tr>
            <td>{t('perf.ram')}</td>
            <td>{estimate.total.ram} MB</td>
            <td>
              <b>{report.ramMB} MB</b>
            </td>
          </tr>
          <tr>
            <td>{t('perf.vram')}</td>
            <td>{estimate.total.vram} MB</td>
            <td>
              <b>+{report.gpuRamDeltaMB} MB</b>
            </td>
          </tr>
          <tr>
            <td>{t('perf.fps')}</td>
            <td>{report.targetFps}</td>
            <td>
              <b>{report.frames.avgFps}</b> <span className="muted small">(p95 {report.frames.p95FrameMs} ms)</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p className="muted small">{t('perf.measuredNote', { seconds: Math.round(report.durationMs / 1000) })}</p>
    </div>
  );
}
