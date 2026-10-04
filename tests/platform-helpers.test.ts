import { describe, expect, it } from 'vitest';
import { accentPalette, dominantAccent, readableOn, toAbgr, toArgb, toColorRef } from '../src/shared/color';
import { parseRange } from '../src/shared/range';
import { parseRegQueryOutput } from '../src/main/win32/registry';

describe('color conversions for Windows', () => {
  it('packs ABGR / ARGB / COLORREF', () => {
    expect(toAbgr('#112233')).toBe(0xff332211);
    expect(toArgb('#112233')).toBe(0xc4112233);
    expect(toColorRef('#112233')).toBe(0x00332211);
  });

  it('builds a 32-byte accent palette with the accent at index 3', () => {
    const p = accentPalette('#6c5cff');
    expect(p.length).toBe(32);
    expect([...p.slice(12, 15)]).toEqual([0x6c, 0x5c, 0xff]);
    expect(p[0]).toBeGreaterThan(p[12]); // lighter first
    expect(p[28]).toBeLessThan(p[12]); // darker last
  });

  it('picks readable text and a saturated dominant color', () => {
    expect(readableOn('#ffffff')).toBe('#000000');
    expect(readableOn('#101010')).toBe('#ffffff');
    const pixels = new Uint8ClampedArray(4 * 400);
    for (let i = 0; i < 400; i++) pixels.set(i < 300 ? [128, 128, 128, 255] : [220, 40, 60, 255], i * 4);
    const hex = dominantAccent(pixels);
    expect(parseInt(hex.slice(1, 3), 16)).toBeGreaterThan(180);
  });
});

describe('reg.exe output parsing', () => {
  const out = `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\DWM
    AccentColor    REG_DWORD    0xff9a5c6c
    Blob    REG_BINARY    30000000FEFFFFFF
    Name    REG_SZ    Hello world
`;
  it('parses DWORD, binary and string values', () => {
    expect(parseRegQueryOutput(out, 'AccentColor')).toEqual({ type: 'REG_DWORD', data: 0xff9a5c6c });
    const blob = parseRegQueryOutput(out, 'blob');
    expect(blob?.type).toBe('REG_BINARY');
    expect(blob?.type === 'REG_BINARY' && blob.data[4]).toBe(0xfe);
    expect(parseRegQueryOutput(out, 'Name')).toEqual({ type: 'REG_SZ', data: 'Hello world' });
    expect(parseRegQueryOutput(out, 'Missing')).toBeNull();
  });
});

describe('HTTP range parsing', () => {
  it('handles open, closed and suffix ranges', () => {
    expect(parseRange('bytes=0-', 100)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
    expect(parseRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parseRange('bytes=50-500', 100)).toEqual({ start: 50, end: 99 });
    expect(parseRange('bytes=200-', 100)).toBeNull();
    expect(parseRange('items=1-2', 100)).toBeNull();
    expect(parseRange(null, 100)).toBeNull();
  });
});
