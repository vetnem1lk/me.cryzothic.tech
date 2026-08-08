// ~20-line hand-rolled i18n: a Lang context + dotted-path lookup into content.json.
// Deliberately no library — two locales do not justify one (stack lock, T5c). The
// language itself is never stored here; it is derived from the URL by locale.ts and
// handed down, so the address bar stays the single source of truth.
import { createContext, useCallback, useContext } from 'react';
import content from '../content.json';
import type { Lang } from './locale';

const LangContext = createContext<Lang>('en');
export const LangProvider = LangContext.Provider;
export const useLang = (): Lang => useContext(LangContext);

const leaf = (o: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((a, k) => (a == null ? a : (a as Record<string, unknown>)[k]), o);

export function useT() {
  const lang = useLang();
  // Falls back EN-then-key so a missing translation degrades to English copy rather
  // than a blank panel; content.test.ts is what keeps that path from ever firing.
  // Identity is stable per language because callers put `t` in effect dependency arrays.
  return useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      // Not-a-string is treated as not-found: the key-passthrough carries service
      // error text too, and a message that happened to name a branch of the
      // dictionary would otherwise render as [object Object].
      const hit = leaf(content[lang], key) ?? leaf(content.en, key);
      let s = typeof hit === 'string' ? hit : key;
      // Function replacement: a value containing `$&` or `$$` is inserted verbatim
      // instead of being read as a replacement pattern.
      if (vars)
        for (const [k, v] of Object.entries(vars)) s = s.replace('${' + k + '}', () => String(v));
      return s;
    },
    [lang],
  );
}
