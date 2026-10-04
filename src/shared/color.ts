export interface RGB {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function shade(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  const target = amount > 0 ? 255 : 0;
  const t = Math.abs(amount);
  return rgbToHex({ r: r + (target - r) * t, g: g + (target - g) * t, b: b + (target - b) * t });
}

export function toAbgr(hex: string, alpha = 0xff): number {
  const { r, g, b } = hexToRgb(hex);
  return ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function toArgb(hex: string, alpha = 0xc4): number {
  const { r, g, b } = hexToRgb(hex);
  return ((alpha << 24) | (r << 16) | (g << 8) | b) >>> 0;
}

export function toColorRef(hex: string): number {
  return toAbgr(hex, 0);
}

export function accentPalette(hex: string): Uint8Array {
  const steps = [0.6, 0.4, 0.2, 0, -0.25, -0.45, -0.65, -0.8];
  const out = new Uint8Array(32);
  steps.forEach((s, i) => {
    const { r, g, b } = hexToRgb(s === 0 ? hex : shade(hex, s));
    out.set([r, g, b, 0], i * 4);
  });
  return out;
}

export function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function readableOn(hex: string): '#000000' | '#ffffff' {
  return luminance(hex) > 0.4 ? '#000000' : '#ffffff';
}

export function dominantAccent(pixels: Uint8ClampedArray | Uint8Array, fallback = '#6c5cff'): string {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number; sat: number }>();
  for (let i = 0; i < pixels.length; i += 16) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    if (a < 128) continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const light = (max + min) / 2 / 255;
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat < 0.25 || light < 0.12 || light > 0.9) continue;
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0, sat: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.sat += sat;
    bucket.n++;
    buckets.set(key, bucket);
  }
  let best: { score: number; hex: string } | null = null;
  for (const b of buckets.values()) {
    const score = b.n * (b.sat / b.n) ** 2;
    if (!best || score > best.score) best = { score, hex: rgbToHex({ r: b.r / b.n, g: b.g / b.n, b: b.b / b.n }) };
  }
  return best?.hex ?? fallback;
}
