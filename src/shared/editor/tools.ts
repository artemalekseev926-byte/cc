/**
 * The editor's tool catalog.
 *
 * Every action a user can take in the editor is a "tool" with a big icon, a
 * plain-language title, a one-line explanation, and a list of search keywords
 * (in every supported language, plus common synonyms and typos). The search box
 * ("What do you want to do?") matches against all of it, so a beginner can type
 * "снег", "прозрачная панель" or "clock" and land on the right tool.
 */
import type { LayerType, ParticlePreset, ShaderPreset } from '../theme/schema';

export type ToolCategory = 'background' | 'effects' | 'widgets' | 'colors' | 'windows' | 'taskbar' | 'desktop' | 'performance';

export type ToolAction =
  | { kind: 'addLayer'; layer: LayerType; preset?: ParticlePreset | ShaderPreset }
  | { kind: 'importMedia'; accept: 'image' | 'video' | 'any' }
  | { kind: 'openSection'; section: 'colors' | 'windows' | 'taskbar' | 'desktop' | 'performance' };

export interface Tool {
  id: string;
  category: ToolCategory;
  icon: string;
  /** i18n keys: `tool.<id>.title` and `tool.<id>.desc` */
  action: ToolAction;
  /** Shown first to beginners. */
  popular?: boolean;
  keywords: string[];
}

export const CATEGORY_ORDER: ToolCategory[] = ['background', 'effects', 'widgets', 'colors', 'windows', 'taskbar', 'desktop', 'performance'];

export const CATEGORY_ICONS: Record<ToolCategory, string> = {
  background: '🖼️',
  effects: '✨',
  widgets: '⏰',
  colors: '🎨',
  windows: '🪟',
  taskbar: '📏',
  desktop: '🗂️',
  performance: '⚡',
};

export const TOOLS: Tool[] = [
  // ── Background ────────────────────────────────────────────────
  {
    id: 'import-image',
    category: 'background',
    icon: '🖼️',
    popular: true,
    action: { kind: 'importMedia', accept: 'image' },
    keywords: ['картинка', 'фото', 'изображение', 'обои', 'фон', 'арт', 'рисунок', 'png', 'jpg', 'image', 'picture', 'photo', 'wallpaper', 'background', 'art'],
  },
  {
    id: 'import-video',
    category: 'background',
    icon: '🎬',
    popular: true,
    action: { kind: 'importMedia', accept: 'video' },
    keywords: ['видео', 'живые обои', 'анимированные', 'анимация', 'ролик', 'mp4', 'webm', 'gif', 'video', 'animated', 'live wallpaper', 'movie'],
  },
  {
    id: 'gradient',
    category: 'background',
    icon: '🌈',
    popular: true,
    action: { kind: 'addLayer', layer: 'gradient' },
    keywords: ['градиент', 'переход цветов', 'перелив', 'цветной фон', 'gradient', 'colors', 'blend'],
  },
  {
    id: 'solid',
    category: 'background',
    icon: '⬛',
    action: { kind: 'addLayer', layer: 'solid' },
    keywords: ['цвет', 'однотонный', 'заливка', 'простой фон', 'solid', 'color', 'fill', 'plain'],
  },
  // ── Effects ───────────────────────────────────────────────────
  {
    id: 'snow',
    category: 'effects',
    icon: '❄️',
    popular: true,
    action: { kind: 'addLayer', layer: 'particles', preset: 'snow' },
    keywords: ['снег', 'снежинки', 'зима', 'новый год', 'snow', 'winter', 'snowflakes', 'christmas'],
  },
  {
    id: 'rain',
    category: 'effects',
    icon: '🌧️',
    action: { kind: 'addLayer', layer: 'particles', preset: 'rain' },
    keywords: ['дождь', 'капли', 'ливень', 'осень', 'rain', 'drops', 'storm'],
  },
  {
    id: 'fireflies',
    category: 'effects',
    icon: '🪲',
    action: { kind: 'addLayer', layer: 'particles', preset: 'fireflies' },
    keywords: ['светлячки', 'огоньки', 'искры', 'боке', 'fireflies', 'sparks', 'glow', 'bokeh'],
  },
  {
    id: 'stars',
    category: 'effects',
    icon: '⭐',
    action: { kind: 'addLayer', layer: 'particles', preset: 'stars' },
    keywords: ['звёзды', 'звезды', 'космос', 'ночь', 'небо', 'stars', 'space', 'night', 'sky'],
  },
  {
    id: 'sakura',
    category: 'effects',
    icon: '🌸',
    action: { kind: 'addLayer', layer: 'particles', preset: 'sakura' },
    keywords: ['сакура', 'лепестки', 'цветы', 'весна', 'аниме', 'sakura', 'petals', 'flowers', 'spring', 'anime'],
  },
  {
    id: 'bubbles',
    category: 'effects',
    icon: '🫧',
    action: { kind: 'addLayer', layer: 'particles', preset: 'bubbles' },
    keywords: ['пузыри', 'пузырьки', 'вода', 'море', 'bubbles', 'water', 'underwater'],
  },
  {
    id: 'aurora',
    category: 'effects',
    icon: '🌌',
    popular: true,
    action: { kind: 'addLayer', layer: 'shader', preset: 'aurora' },
    keywords: ['северное сияние', 'аврора', 'сияние', 'aurora', 'northern lights'],
  },
  {
    id: 'waves',
    category: 'effects',
    icon: '🌊',
    action: { kind: 'addLayer', layer: 'shader', preset: 'waves' },
    keywords: ['волны', 'вода', 'океан', 'море', 'waves', 'ocean', 'sea', 'water'],
  },
  {
    id: 'plasma',
    category: 'effects',
    icon: '🔮',
    action: { kind: 'addLayer', layer: 'shader', preset: 'plasma' },
    keywords: ['плазма', 'абстракция', 'психоделика', 'переливы', 'plasma', 'abstract', 'psychedelic'],
  },
  {
    id: 'nebula',
    category: 'effects',
    icon: '🪐',
    action: { kind: 'addLayer', layer: 'shader', preset: 'nebula' },
    keywords: ['туманность', 'космос', 'галактика', 'дым', 'nebula', 'galaxy', 'space', 'smoke'],
  },
  {
    id: 'grid',
    category: 'effects',
    icon: '🕹️',
    action: { kind: 'addLayer', layer: 'shader', preset: 'grid' },
    keywords: ['неон', 'сетка', 'ретро', 'синтвейв', 'киберпанк', 'neon', 'grid', 'retro', 'synthwave', 'cyberpunk', 'outrun'],
  },
  // ── Widgets ───────────────────────────────────────────────────
  {
    id: 'clock',
    category: 'widgets',
    icon: '⏰',
    popular: true,
    action: { kind: 'addLayer', layer: 'clock' },
    keywords: ['часы', 'время', 'дата', 'календарь', 'clock', 'time', 'date'],
  },
  {
    id: 'text',
    category: 'widgets',
    icon: '🔤',
    action: { kind: 'addLayer', layer: 'text' },
    keywords: ['текст', 'надпись', 'цитата', 'подпись', 'слова', 'text', 'quote', 'label', 'caption'],
  },
  // ── Colors ────────────────────────────────────────────────────
  {
    id: 'accent',
    category: 'colors',
    icon: '🎨',
    popular: true,
    action: { kind: 'openSection', section: 'colors' },
    keywords: ['цвет', 'акцент', 'цвета windows', 'тема', 'тёмная тема', 'темная', 'светлая', 'прозрачность', 'accent', 'colors', 'dark mode', 'light mode', 'transparency'],
  },
  // ── Windows ───────────────────────────────────────────────────
  {
    id: 'window-style',
    category: 'windows',
    icon: '🪟',
    popular: true,
    action: { kind: 'openSection', section: 'windows' },
    keywords: ['окна', 'рамка', 'углы', 'скругление', 'заголовок', 'анимация окон', 'border', 'corners', 'title bar', 'window animation', 'windows'],
  },
  // ── Taskbar ───────────────────────────────────────────────────
  {
    id: 'taskbar',
    category: 'taskbar',
    icon: '📏',
    popular: true,
    action: { kind: 'openSection', section: 'taskbar' },
    keywords: ['панель задач', 'панель', 'таскбар', 'пуск', 'сверху', 'слева', 'по центру', 'скрывать', 'taskbar', 'panel', 'start', 'dock', 'position', 'autohide'],
  },
  // ── Desktop ───────────────────────────────────────────────────
  {
    id: 'desktop-icons',
    category: 'desktop',
    icon: '🗂️',
    action: { kind: 'openSection', section: 'desktop' },
    keywords: ['значки', 'иконки', 'ярлыки', 'рабочий стол', 'скрыть значки', 'icons', 'shortcuts', 'desktop'],
  },
  // ── Performance ───────────────────────────────────────────────
  {
    id: 'performance',
    category: 'performance',
    icon: '⚡',
    action: { kind: 'openSection', section: 'performance' },
    keywords: ['производительность', 'нагрузка', 'тормозит', 'лагает', 'fps', 'кадры', 'батарея', 'ресурсы', 'игры', 'performance', 'lag', 'battery', 'resources', 'gaming'],
  },
];

/** Lowercases and folds ё→е so that "звезды" matches "звёзды". */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е').trim();
}

/** Small Levenshtein distance for typo tolerance on short words. */
function distance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

/**
 * Ranks tools against a free-text query.
 * @param titleOf resolves a tool to its localized title + description (also searched).
 */
export function searchTools(query: string, titleOf: (tool: Tool) => string = () => ''): Tool[] {
  const q = normalize(query);
  if (!q) return TOOLS;
  const words = q.split(/\s+/).filter(Boolean);
  const scored = TOOLS.map((tool) => {
    const haystack = [...tool.keywords, titleOf(tool)].map(normalize);
    let score = 0;
    for (const word of words) {
      let best = 0;
      for (const hay of haystack) {
        if (hay === word) best = Math.max(best, 10);
        else if (hay.startsWith(word)) best = Math.max(best, 7);
        else if (hay.includes(word)) best = Math.max(best, 5);
        else if (word.length >= 4) {
          for (const token of hay.split(/\s+/)) {
            if (distance(token, word) <= (word.length >= 7 ? 2 : 1)) best = Math.max(best, 3);
          }
        }
      }
      score += best;
    }
    if (tool.popular) score += 0.5;
    return { tool, score };
  });
  return scored
    .filter((s) => s.score >= words.length * 3)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.tool);
}
