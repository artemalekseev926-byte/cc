import { z } from 'zod';

export const THEME_SCHEMA_VERSION = 1;

const hexColor = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'Expected #RRGGBB or #RRGGBBAA');
const unit = z.number().min(0).max(1);

export const BlendModeSchema = z.enum(['normal', 'screen', 'multiply', 'overlay', 'lighten', 'darken', 'soft-light']);
export const FitSchema = z.enum(['cover', 'contain', 'fill', 'center']);

const layerBase = {
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  visible: z.boolean().default(true),
  opacity: unit.default(1),
  blendMode: BlendModeSchema.default('normal'),
};

export const SolidLayerSchema = z.object({
  ...layerBase,
  type: z.literal('solid'),
  color: hexColor,
});

export const GradientLayerSchema = z.object({
  ...layerBase,
  type: z.literal('gradient'),
  colors: z.array(hexColor).min(2).max(6),
  angle: z.number().min(0).max(360).default(135),
  animated: z.boolean().default(true),
  cycleSeconds: z.number().min(2).max(120).default(20),
});

export const ImageLayerSchema = z.object({
  ...layerBase,
  type: z.literal('image'),
  asset: z.string().min(1),
  fit: FitSchema.default('cover'),
  parallax: unit.default(0),
  blur: z.number().min(0).max(40).default(0),
  slowZoom: z.boolean().default(false),
});

export const VideoLayerSchema = z.object({
  ...layerBase,
  type: z.literal('video'),
  asset: z.string().min(1),
  fit: FitSchema.default('cover'),
  playbackRate: z.number().min(0.25).max(2).default(1),
});

export const ParticlePresetSchema = z.enum(['snow', 'rain', 'fireflies', 'stars', 'bubbles', 'sakura']);
export const ParticlesLayerSchema = z.object({
  ...layerBase,
  type: z.literal('particles'),
  preset: ParticlePresetSchema,
  count: z.number().int().min(10).max(3000).default(200),
  speed: z.number().min(0.1).max(5).default(1),
  size: z.number().min(0.5).max(6).default(1),
  color: hexColor.default('#ffffff'),
  interactive: z.boolean().default(false),
});

export const ShaderPresetSchema = z.enum(['aurora', 'waves', 'plasma', 'nebula', 'grid']);
export const ShaderLayerSchema = z.object({
  ...layerBase,
  type: z.literal('shader'),
  preset: ShaderPresetSchema,
  speed: z.number().min(0.1).max(4).default(1),
  colorA: hexColor.default('#5b2bff'),
  colorB: hexColor.default('#00e0ff'),
  quality: z.number().min(0.25).max(1).default(0.75),
});

export const WidgetPositionSchema = z.enum(['top-left', 'top-center', 'top-right', 'center', 'bottom-left', 'bottom-center', 'bottom-right']);
export const ClockLayerSchema = z.object({
  ...layerBase,
  type: z.literal('clock'),
  format: z.enum(['24h', '12h']).default('24h'),
  showDate: z.boolean().default(true),
  showSeconds: z.boolean().default(false),
  position: WidgetPositionSchema.default('center'),
  color: hexColor.default('#ffffff'),
  fontSize: z.number().min(16).max(240).default(96),
  font: z.enum(['system', 'serif', 'mono', 'rounded']).default('system'),
});

export const TextLayerSchema = z.object({
  ...layerBase,
  type: z.literal('text'),
  text: z.string().max(200),
  position: WidgetPositionSchema.default('bottom-right'),
  color: hexColor.default('#ffffff'),
  fontSize: z.number().min(12).max(200).default(32),
  font: z.enum(['system', 'serif', 'mono', 'rounded']).default('system'),
});

export const LayerSchema = z.discriminatedUnion('type', [
  SolidLayerSchema,
  GradientLayerSchema,
  ImageLayerSchema,
  VideoLayerSchema,
  ParticlesLayerSchema,
  ShaderLayerSchema,
  ClockLayerSchema,
  TextLayerSchema,
]);

export const AssetSchema = z.object({
  file: z.string().min(1),
  kind: z.enum(['image', 'video']),
  bytes: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSec: z.number().positive().optional(),
  fps: z.number().positive().optional(),
});

export const WallpaperSchema = z.object({
  layers: z.array(LayerSchema).max(16),
  fpsLimit: z.union([z.literal(15), z.literal(24), z.literal(30), z.literal(60), z.literal(120), z.literal(144)]).default(30),
  pauseOnFullscreen: z.boolean().default(true),
  pauseOnBattery: z.boolean().default(true),
});

export const ColorsSchema = z.object({
  accent: hexColor,
  mode: z.enum(['dark', 'light']).default('dark'),
  accentOnTaskbar: z.boolean().default(false),
  accentOnTitleBars: z.boolean().default(true),
  transparency: z.boolean().default(true),
  autoAccentFromWallpaper: z.boolean().default(false),
});

export const WindowsStyleSchema = z.object({
  animations: z.boolean().default(true),
  corners: z.enum(['default', 'round', 'round-small', 'square']).default('default'),
  borderColor: hexColor.nullable().default(null),
  captionColor: hexColor.nullable().default(null),
  captionTextColor: hexColor.nullable().default(null),
});

export const TaskbarSchema = z.object({
  position: z.enum(['bottom', 'top', 'left', 'right']).default('bottom'),
  alignment: z.enum(['left', 'center']).default('center'),
  autoHide: z.boolean().default(false),
  size: z.enum(['small', 'default']).default('default'),
});

export const DesktopSchema = z.object({
  showIcons: z.boolean().default(true),
  iconSize: z.enum(['small', 'medium', 'large']).default('medium'),
});

export const ThemeSchema = z.object({
  schemaVersion: z.literal(THEME_SCHEMA_VERSION),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,63}$/, 'Lowercase letters, digits and dashes'),
  name: z.string().min(1).max(80),
  author: z.string().max(80).default(''),
  description: z.string().max(4000).default(''),
  tags: z.array(z.string().max(32)).max(12).default([]),
  version: z.string().default('1.0.0'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  wallpaper: WallpaperSchema,
  colors: ColorsSchema,
  windows: WindowsStyleSchema,
  taskbar: TaskbarSchema,
  desktop: DesktopSchema,
  assets: z.record(z.string(), AssetSchema).default({}),
});

export type BlendMode = z.infer<typeof BlendModeSchema>;
export type Fit = z.infer<typeof FitSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type LayerType = Layer['type'];
export type SolidLayer = z.infer<typeof SolidLayerSchema>;
export type GradientLayer = z.infer<typeof GradientLayerSchema>;
export type ImageLayer = z.infer<typeof ImageLayerSchema>;
export type VideoLayer = z.infer<typeof VideoLayerSchema>;
export type ParticlesLayer = z.infer<typeof ParticlesLayerSchema>;
export type ParticlePreset = z.infer<typeof ParticlePresetSchema>;
export type ShaderLayer = z.infer<typeof ShaderLayerSchema>;
export type ShaderPreset = z.infer<typeof ShaderPresetSchema>;
export type ClockLayer = z.infer<typeof ClockLayerSchema>;
export type TextLayer = z.infer<typeof TextLayerSchema>;
export type WidgetPosition = z.infer<typeof WidgetPositionSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type Wallpaper = z.infer<typeof WallpaperSchema>;
export type Colors = z.infer<typeof ColorsSchema>;
export type WindowsStyle = z.infer<typeof WindowsStyleSchema>;
export type Taskbar = z.infer<typeof TaskbarSchema>;
export type Desktop = z.infer<typeof DesktopSchema>;
export type Theme = z.infer<typeof ThemeSchema>;

export type ParseResult = { ok: true; theme: Theme } | { ok: false; errors: string[] };

export function parseTheme(input: unknown): ParseResult {
  const result = ThemeSchema.safeParse(input);
  if (result.success) {
    const theme = result.data;
    const missing = referencedAssets(theme).filter((key) => !theme.assets[key]);
    if (missing.length > 0) {
      return { ok: false, errors: missing.map((key) => `Layer references unknown asset "${key}"`) };
    }
    return { ok: true, theme };
  }
  return {
    ok: false,
    errors: result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`),
  };
}

export function referencedAssets(theme: Pick<Theme, 'wallpaper'>): string[] {
  const keys = new Set<string>();
  for (const layer of theme.wallpaper.layers) {
    if (layer.type === 'image' || layer.type === 'video') keys.add(layer.asset);
  }
  return [...keys];
}

export function slugify(name: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
    н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  const latin = [...name.toLowerCase()].map((ch) => map[ch] ?? ch).join('');
  const slug = latin.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return slug.length >= 2 ? slug : `theme-${slug || 'new'}`;
}
