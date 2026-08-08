// Pins the dictionary's shape, not its wording: every EN key has an RU twin, no
// language ships a blank string, and a `${var}` on one side exists on the other.
// A missing translation is invisible at runtime (useT falls back to EN) — these
// three assertions are what makes it visible at build time instead.
import { describe, expect, test } from 'vitest';
import content from './content.json';

const paths = (o: unknown, p = ''): string[] =>
  typeof o === 'string'
    ? [p]
    : Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
        paths(v, p ? `${p}.${k}` : k),
      );

const leaf = (o: unknown, path: string): string =>
  path.split('.').reduce((a: unknown, k) => (a as Record<string, unknown>)[k], o) as string;

describe('content.json', () => {
  test('en/ru key parity (deep, exact)', () =>
    expect(paths(content.ru).sort()).toEqual(paths(content.en).sort()));

  test('no empty strings in either language', () => {
    for (const lang of ['en', 'ru'] as const)
      for (const p of paths(content[lang])) expect(leaf(content[lang], p), `${lang}:${p}`).not.toBe('');
  });

  test('interpolation placeholders match across languages', () => {
    const ph = (s: string) => (s.match(/\$\{\w+\}/g) ?? []).sort();
    for (const p of paths(content.en))
      expect(ph(leaf(content.ru, p)), p).toEqual(ph(leaf(content.en, p)));
  });

  // The interpolation surface is a contract with the call sites, not a free-for-all:
  // useT() only substitutes what a caller passes, so a third variable added here
  // without a matching call site would render as literal `${…}` on screen.
  test('only ${mode} and ${status} are interpolated, in exactly two keys', () => {
    const interpolated = paths(content.en).filter((p) => /\$\{\w+\}/.test(leaf(content.en, p)));
    expect(interpolated.sort()).toEqual(['vai.error.status', 'vai.sys.ask']);
    expect(leaf(content.en, 'vai.sys.ask')).toContain('${mode}');
    expect(leaf(content.en, 'vai.error.status')).toContain('${status}');
  });

  // Moved here from transport.test.ts when the hints left MODE_HINT for the
  // dictionary: whatever the language, the hint is what tells a visitor which of
  // the two agents they are talking to, so the expansion has to survive a rewrite.
  test('mode hints expand both agent names, in both languages', () => {
    for (const lang of ['en', 'ru'] as const) {
      expect(leaf(content[lang], 'vai.sys.modeVai')).toContain('VladislavAI');
      expect(leaf(content[lang], 'vai.sys.modeGai')).toContain('GlobalAI');
    }
  });
});
