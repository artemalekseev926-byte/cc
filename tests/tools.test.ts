import { describe, expect, it } from 'vitest';
import { TOOLS, searchTools } from '../src/shared/editor/tools';

const top = (q: string) => searchTools(q)[0]?.id;

describe('tool search', () => {
  it('finds tools by Russian and English words', () => {
    expect(top('снег')).toBe('snow');
    expect(top('snow')).toBe('snow');
    expect(top('часы')).toBe('clock');
    expect(top('панель задач')).toBe('taskbar');
    expect(top('живые обои')).toBe('import-video');
    expect(top('северное сияние')).toBe('aurora');
  });

  it('folds ё and tolerates small typos', () => {
    expect(top('звезды')).toBe('stars');
    expect(top('светлячк')).toBe('fireflies');
    expect(top('прозрачность')).toBe('accent');
    expect(top('taskbr')).toBe('taskbar');
  });

  it('returns everything for an empty query and nothing for nonsense', () => {
    expect(searchTools('  ')).toHaveLength(TOOLS.length);
    expect(searchTools('qwertyzxcv')).toHaveLength(0);
  });

  it('every tool has a unique id and keywords', () => {
    expect(new Set(TOOLS.map((t) => t.id)).size).toBe(TOOLS.length);
    for (const tool of TOOLS) expect(tool.keywords.length).toBeGreaterThan(2);
  });
});
