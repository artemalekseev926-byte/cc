/** Compact live resource meter (static estimate) used in the editor status bar and library cards. */
import type { Estimate, Rating } from '../../shared/perf/estimator';
import { useT } from '../app/i18n';

export const RATING_TONE: Record<Rating, 'ok' | 'warn' | 'bad'> = { light: 'ok', medium: 'ok', heavy: 'warn', extreme: 'bad' };
export const RATING_ICON: Record<Rating, string> = { light: '🟢', medium: '🟡', heavy: '🟠', extreme: '🔴' };

export function RatingBadge({ rating }: { rating: Rating }) {
  const t = useT();
  return (
    <span className={`badge badge-${RATING_TONE[rating]}`} title={t(`rating.${rating}.desc`)}>
      {RATING_ICON[rating]} {t(`rating.${rating}`)}
    </span>
  );
}

export function PerfMeter({ estimate, onClick }: { estimate: Estimate; onClick?: () => void }) {
  const t = useT();
  const { total } = estimate;
  return (
    <button type="button" className="perf-meter" onClick={onClick} title={t('perf.meterTitle')}>
      <RatingBadge rating={estimate.rating} />
      <span className="perf-meter-item" title={t('perf.cpuHint')}>
        CPU <b>~{total.cpu}%</b>
      </span>
      <span className="perf-meter-item" title={t('perf.gpuHint')}>
        GPU <b>~{total.gpu}%</b>
      </span>
      <span className="perf-meter-item" title={t('perf.ramHint')}>
        RAM <b>{total.ram} MB</b>
      </span>
      <span className="perf-meter-item" title={t('perf.vramHint')}>
        VRAM <b>{total.vram} MB</b>
      </span>
    </button>
  );
}
