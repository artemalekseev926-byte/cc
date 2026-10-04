import type { LayerType, ParticlePreset, ShaderPreset } from '../theme/schema';

export type ToolCategory = 'background' | 'effects' | 'widgets' | 'colors' | 'windows' | 'taskbar' | 'desktop' | 'performance';

export type ToolAction =
  | { kind: 'addLayer'; layer: LayerType; preset?: ParticlePreset | ShaderPreset }
  | { kind: 'importMedia'; accept: 'image' | 'video' | 'audio' | 'any' }
  | { kind: 'openSection'; section: 'colors' | 'windows' | 'taskbar' | 'desktop' | 'performance' };

export interface Tool {
  id: string;
  category: ToolCategory;
  icon: string;
  action: ToolAction;
  popular?: boolean;
  keywords: string[];
}

export const CATEGORY_ORDER: ToolCategory[] = ['background', 'effects', 'widgets', 'colors', 'windows', 'taskbar', 'desktop', 'performance'];

export const CATEGORY_ICONS: Record<ToolCategory, string> = {
  background: 'image',
  effects: 'sparkles',
  widgets: 'clock',
  colors: 'palette',
  windows: 'app-window',
  taskbar: 'panel-bottom',
  desktop: 'layout-grid',
  performance: 'gauge',
};

export const TOOLS: Tool[] = [
  {
    id: 'import-image',
    category: 'background',
    icon: 'image-plus',
    popular: true,
    action: { kind: 'importMedia', accept: 'image' },
    keywords: ['картинка', 'фото', 'изображение', 'обои', 'фон', 'арт', 'рисунок', 'png', 'jpg', 'image', 'picture', 'photo', 'wallpaper', 'background', 'art'],
  },
  {
    id: 'import-video',
    category: 'background',
    icon: 'clapperboard',
    popular: true,
    action: { kind: 'importMedia', accept: 'video' },
    keywords: ['видео', 'живые обои', 'анимированные', 'анимация', 'ролик', 'mp4', 'webm', 'gif', 'video', 'animated', 'live wallpaper', 'movie'],
  },
  {
    id: 'import-audio',
    category: 'background',
    icon: 'music',
    popular: true,
    action: { kind: 'importMedia', accept: 'audio' },
    keywords: ['звук', 'музыка', 'мелодия', 'песня', 'шум', 'дождь звук', 'аудио', 'mp3', 'ogg', 'wav', 'sound', 'music', 'audio', 'ambient', 'song'],
  },
  {
    id: 'gradient',
    category: 'background',
    icon: 'rainbow',
    popular: true,
    action: { kind: 'addLayer', layer: 'gradient' },
    keywords: ['градиент', 'переход цветов', 'перелив', 'цветной фон', 'gradient', 'colors', 'blend'],
  },
  {
    id: 'solid',
    category: 'background',
    icon: 'square',
    action: { kind: 'addLayer', layer: 'solid' },
    keywords: ['цвет', 'однотонный', 'заливка', 'простой фон', 'solid', 'color', 'fill', 'plain'],
  },
  {
    id: 'snow',
    category: 'effects',
    icon: 'snowflake',
    popular: true,
    action: { kind: 'addLayer', layer: 'particles', preset: 'snow' },
    keywords: ['снег', 'снежинки', 'зима', 'новый год', 'snow', 'winter', 'snowflakes', 'christmas'],
  },
  {
    id: 'rain',
    category: 'effects',
    icon: 'cloud-rain',
    action: { kind: 'addLayer', layer: 'particles', preset: 'rain' },
    keywords: ['дождь', 'капли', 'ливень', 'осень', 'rain', 'drops', 'storm'],
  },
  {
    id: 'fireflies',
    category: 'effects',
    icon: 'bug',
    action: { kind: 'addLayer', layer: 'particles', preset: 'fireflies' },
    keywords: ['светлячки', 'огоньки', 'искры', 'боке', 'fireflies', 'sparks', 'glow', 'bokeh'],
  },
  {
    id: 'stars',
    category: 'effects',
    icon: 'star',
    action: { kind: 'addLayer', layer: 'particles', preset: 'stars' },
    keywords: ['звёзды', 'звезды', 'космос', 'ночь', 'небо', 'stars', 'space', 'night', 'sky'],
  },
  {
    id: 'sakura',
    category: 'effects',
    icon: 'flower',
    action: { kind: 'addLayer', layer: 'particles', preset: 'sakura' },
    keywords: ['сакура', 'лепестки', 'цветы', 'весна', 'аниме', 'sakura', 'petals', 'flowers', 'spring', 'anime'],
  },
  {
    id: 'bubbles',
    category: 'effects',
    icon: 'droplets',
    action: { kind: 'addLayer', layer: 'particles', preset: 'bubbles' },
    keywords: ['пузыри', 'пузырьки', 'вода', 'море', 'bubbles', 'water', 'underwater'],
  },
  {
    id: 'aurora',
    category: 'effects',
    icon: 'wand',
    popular: true,
    action: { kind: 'addLayer', layer: 'shader', preset: 'aurora' },
    keywords: ['северное сияние', 'аврора', 'сияние', 'aurora', 'northern lights'],
  },
  {
    id: 'waves',
    category: 'effects',
    icon: 'waves',
    action: { kind: 'addLayer', layer: 'shader', preset: 'waves' },
    keywords: ['волны', 'вода', 'океан', 'море', 'waves', 'ocean', 'sea', 'water'],
  },
  {
    id: 'plasma',
    category: 'effects',
    icon: 'gem',
    action: { kind: 'addLayer', layer: 'shader', preset: 'plasma' },
    keywords: ['плазма', 'абстракция', 'психоделика', 'переливы', 'plasma', 'abstract', 'psychedelic'],
  },
  {
    id: 'nebula',
    category: 'effects',
    icon: 'orbit',
    action: { kind: 'addLayer', layer: 'shader', preset: 'nebula' },
    keywords: ['туманность', 'космос', 'галактика', 'дым', 'nebula', 'galaxy', 'space', 'smoke'],
  },
  {
    id: 'grid',
    category: 'effects',
    icon: 'grid',
    action: { kind: 'addLayer', layer: 'shader', preset: 'grid' },
    keywords: ['неон', 'сетка', 'ретро', 'синтвейв', 'киберпанк', 'neon', 'grid', 'retro', 'synthwave', 'cyberpunk', 'outrun'],
  },
  {
    id: 'clock',
    category: 'widgets',
    icon: 'clock',
    popular: true,
    action: { kind: 'addLayer', layer: 'clock' },
    keywords: ['часы', 'время', 'дата', 'календарь', 'clock', 'time', 'date'],
  },
  {
    id: 'text',
    category: 'widgets',
    icon: 'type',
    action: { kind: 'addLayer', layer: 'text' },
    keywords: ['текст', 'надпись', 'цитата', 'подпись', 'слова', 'text', 'quote', 'label', 'caption'],
  },
  {
    id: 'accent',
    category: 'colors',
    icon: 'palette',
    popular: true,
    action: { kind: 'openSection', section: 'colors' },
    keywords: ['цвет', 'акцент', 'цвета windows', 'тема', 'тёмная тема', 'темная', 'светлая', 'прозрачность', 'accent', 'colors', 'dark mode', 'light mode', 'transparency'],
  },
  {
    id: 'window-style',
    category: 'windows',
    icon: 'app-window',
    popular: true,
    action: { kind: 'openSection', section: 'windows' },
    keywords: ['окна', 'рамка', 'углы', 'скругление', 'заголовок', 'анимация окон', 'border', 'corners', 'title bar', 'window animation', 'windows'],
  },
  {
    id: 'taskbar',
    category: 'taskbar',
    icon: 'panel-bottom',
    popular: true,
    action: { kind: 'openSection', section: 'taskbar' },
    keywords: ['панель задач', 'панель', 'таскбар', 'пуск', 'сверху', 'слева', 'по центру', 'скрывать', 'taskbar', 'panel', 'start', 'dock', 'position', 'autohide'],
  },
  {
    id: 'desktop-icons',
    category: 'desktop',
    icon: 'layout-grid',
    action: { kind: 'openSection', section: 'desktop' },
    keywords: ['значки', 'иконки', 'ярлыки', 'рабочий стол', 'скрыть значки', 'icons', 'shortcuts', 'desktop'],
  },
  {
    id: 'performance',
    category: 'performance',
    icon: 'gauge',
    action: { kind: 'openSection', section: 'performance' },
    keywords: ['производительность', 'нагрузка', 'тормозит', 'лагает', 'fps', 'кадры', 'батарея', 'ресурсы', 'игры', 'performance', 'lag', 'battery', 'resources', 'gaming'],
  },
];

export function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е').trim();
}

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
