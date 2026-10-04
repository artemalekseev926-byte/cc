import { estimateTheme, type DisplayInfo } from '../perf/estimator';
import { referencedAssets, type Theme } from '../theme/schema';
import { LIMITS } from './import';

export type CheckLevel = 'ok' | 'warning' | 'error';

export interface Check {
  id: string;
  level: CheckLevel;
  key: string;
  params?: Record<string, string | number>;
}

export const THEME_TAGS = [
  'Anime',
  'Nature',
  'Space',
  'Abstract',
  'Minimal',
  'Cyberpunk',
  'Games',
  'Cars',
  'Fantasy',
  'Pixel Art',
  'Seasonal',
  'Dark',
  'Light',
  'Animated',
  'Static',
  'Widgets',
] as const;

export interface ExportInput {
  theme: Theme;
  title: string;
  description: string;
  tags: string[];
  previewBytes: number | null;
  contentBytes: number;
  display?: DisplayInfo;
}

export function validateForExport(input: ExportInput): Check[] {
  const checks: Check[] = [];
  const { theme } = input;

  const title = input.title.trim();
  if (title.length < 3) checks.push({ id: 'title', level: 'error', key: 'check.titleShort' });
  else if (title.length > 80) checks.push({ id: 'title', level: 'error', key: 'check.titleLong' });
  else checks.push({ id: 'title', level: 'ok', key: 'check.titleOk' });

  const desc = input.description.trim();
  if (desc.length === 0) checks.push({ id: 'description', level: 'warning', key: 'check.noDescription' });
  else checks.push({ id: 'description', level: 'ok', key: 'check.descriptionOk' });

  if (input.tags.length === 0) checks.push({ id: 'tags', level: 'warning', key: 'check.noTags' });
  else checks.push({ id: 'tags', level: 'ok', key: 'check.tagsOk', params: { count: input.tags.length } });

  if (input.previewBytes === null) checks.push({ id: 'preview', level: 'warning', key: 'check.noPreview' });
  else if (input.previewBytes > LIMITS.previewMaxBytes) checks.push({ id: 'preview', level: 'warning', key: 'check.previewBig' });
  else checks.push({ id: 'preview', level: 'ok', key: 'check.previewOk' });

  const visible = theme.wallpaper.layers.filter((l) => l.visible);
  if (visible.length === 0) checks.push({ id: 'layers', level: 'error', key: 'check.noLayers' });
  else checks.push({ id: 'layers', level: 'ok', key: 'check.layersOk', params: { count: visible.length } });

  const missing = referencedAssets(theme).filter((k) => !theme.assets[k]);
  if (missing.length) checks.push({ id: 'assets', level: 'error', key: 'check.missingAssets', params: { list: missing.join(', ') } });

  const unused = Object.keys(theme.assets).filter((k) => !referencedAssets(theme).includes(k));
  if (unused.length) checks.push({ id: 'unused', level: 'warning', key: 'check.unusedAssets', params: { count: unused.length } });

  const mb = Math.round(input.contentBytes / (1024 * 1024));
  if (input.contentBytes > LIMITS.packageMaxBytes) checks.push({ id: 'size', level: 'error', key: 'check.sizeHuge', params: { mb } });
  else if (input.contentBytes > 300 * 1024 * 1024) checks.push({ id: 'size', level: 'warning', key: 'check.sizeLarge', params: { mb } });
  else checks.push({ id: 'size', level: 'ok', key: 'check.sizeOk', params: { mb } });

  const estimate = estimateTheme(theme, input.display);
  const perfLevel = estimate.rating === 'heavy' || estimate.rating === 'extreme' ? 'warning' : 'ok';
  checks.push({ id: 'performance', level: perfLevel, key: `check.perf.${estimate.rating}`, params: { score: estimate.score } });

  return checks;
}

export function canExport(checks: Check[]): boolean {
  return checks.every((c) => c.level !== 'error');
}
