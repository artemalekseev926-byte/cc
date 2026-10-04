import { useCallback } from 'react';
import { resolveLang, translate, type Lang } from '../../shared/i18n';
import { useStudio } from './store';

export type TFunction = (key: string, params?: Record<string, string | number>) => string;

export function useLang(): Lang {
  const setting = useStudio((s) => s.settings?.language ?? 'auto');
  return resolveLang(setting, typeof navigator !== 'undefined' ? navigator.language : 'en');
}

export function useT(): TFunction {
  const lang = useLang();
  return useCallback((key, params) => translate(lang, key, params), [lang]);
}
