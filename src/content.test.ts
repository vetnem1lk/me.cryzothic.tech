// Pins the dictionary's shape, not its wording: every EN key has an RU twin, no
// language ships a blank string, and a `${var}` on one side exists on the other.
// A missing translation is invisible at runtime (useT falls back to EN) — these
// three assertions are what makes it visible at build time instead.
import { describe, expect, test } from 'vitest';
import { CHAPTERS } from './components/board/story';
import content from './content.json';
import { translate } from './i18n/I18nContext';

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

  // The `[sys]` badge belongs to the renderer: it is printed once, at the one place
  // a sys line is drawn, so every line the shell writes wears it whether it came
  // from here or from the service. A dictionary string carrying its own copy would
  // arrive on screen with two.
  test('no sys line carries its own [sys] prefix', () => {
    for (const lang of ['en', 'ru'] as const)
      for (const p of paths(content[lang]).filter((k) => k.startsWith('vai.sys.')))
        expect(leaf(content[lang], p), `${lang}:${p}`).not.toMatch(/^\[sys\]/);
  });

  // The /nda view zips this array against the store's chapter list by index — the
  // photo, the quest and the copy for one tile come from three different files. A
  // reordered or short array would pair the wrong story with the wrong picture and
  // nothing would throw, so the two lists are compared against each other rather
  // than each against a copy of the codes: reordering the store's QUESTS table is
  // exactly the change a literal list here would wave through.
  test('nda chapters match the store, one for one, in order', () => {
    for (const lang of ['en', 'ru'] as const)
      expect(content[lang].sector.nda.chapters.map((c) => c.code)).toEqual(CHAPTERS);
  });

  // The dialogue check indexes its outcome by the choice the visitor pressed, and the
  // store types that choice `0 | 1 | 2` — so three is a contract, not a length that
  // happens to be three today. Key parity alone would wave a matched pair of two-item
  // arrays straight through, into an out-of-range read on the third button.
  test('the dialogue offers exactly three choices and three outcomes', () => {
    for (const lang of ['en', 'ru'] as const) {
      expect(content[lang].sector.nda.dialog.choices, lang).toHaveLength(3);
      expect(content[lang].sector.nda.dialog.outcomes, lang).toHaveLength(3);
    }
  });

  // The two language commands confirm in the language they switch to, not in the
  // one the visitor typed from — the line lands in the log next to a page that
  // already speaks it. So both dictionaries carry the same two strings on purpose;
  // this is not a missed translation.
  test('language-switch confirmations read in the target language', () => {
    expect(content.ru.commands.en).toBe(content.en.commands.en);
    expect(content.en.commands.ru).toBe(content.ru.commands.ru);
  });

  // The passthrough is a contract, not an accident: a service error arrives as
  // prose, not as a key, and has to reach the screen unchanged (still English)
  // instead of being swallowed or rendered blank. Pinned on the pure resolver —
  // useT is a hook and these tests run without a renderer.
  test('a non-key string passes through unchanged, in either language', () => {
    const prose = 'Upstream is out of budget for today. Try again tomorrow.';
    for (const lang of ['en', 'ru'] as const) expect(translate(lang, prose)).toBe(prose);
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
