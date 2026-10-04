import { en } from './en';
import { ru } from './ru';

export type Lang = 'ru' | 'en';
export type Dictionary = Record<string, string>;

export const DICTIONARIES: Record<Lang, Dictionary> = { ru, en };

export function resolveLang(setting: 'auto' | Lang, navigatorLang = 'en'): Lang {
  if (setting !== 'auto') return setting;
  return /^(ru|uk|be|kk)\b/i.test(navigatorLang) ? 'ru' : 'en';
}

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const template = DICTIONARIES[lang][key] ?? DICTIONARIES.en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => (params[name] !== undefined ? String(params[name]) : `{${name}}`));
}
