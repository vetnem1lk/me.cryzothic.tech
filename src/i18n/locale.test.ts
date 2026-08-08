// Pins the URL<->language contract: which paths are Russian, which browser
// languages open in Russian, and how a path maps to its twin in the other
// language. '/rules' and '/russian' are the traps — they must stay English.
import { describe, expect, test } from 'vitest';
import { langFromPath, mirrorPath, mirrorTarget, pathForLang, pickInitialLocale } from './locale';

describe('langFromPath', () => {
  test.each([
    ['/', 'en'], ['/career', 'en'], ['/ru', 'ru'], ['/ru/', 'ru'],
    ['/ru/career', 'ru'], ['/rules', 'en'], ['/russian', 'en'],
  ])('%s -> %s', (path, lang) => expect(langFromPath(path)).toBe(lang));
});

describe('pickInitialLocale', () => {
  test.each([
    ['ru', 'ru'], ['ru-RU', 'ru'], ['RU-ru', 'ru'],
    ['en-US', 'en'], ['de', 'en'], [undefined, 'en'], ['', 'en'],
  ])('%s -> %s', (nav, lang) => expect(pickInitialLocale(nav)).toBe(lang));
});

describe('mirrorPath', () => {
  test.each([
    ['/', '/ru'], ['/career', '/ru/career'], ['/3d', '/ru/3d'],
    ['/ru', '/'], ['/ru/', '/'], ['/ru/career', '/career'],
  ])('%s -> %s', (from, to) => expect(mirrorPath(from)).toBe(to));
  test('round-trip', () => expect(mirrorPath(mirrorPath('/ru/loot'))).toBe('/ru/loot'));
});

// What /en and /ru ask for: the same place, in the named language. Asking for the
// language you are already reading is a no-op, NOT a flip — that is the whole
// difference from mirrorPath, which has no opinion about where you started.
describe('pathForLang', () => {
  test.each([
    ['en', '/career', '/career'], ['ru', '/career', '/ru/career'],
    ['en', '/ru/loot', '/loot'], ['ru', '/ru/loot', '/ru/loot'],
    ['en', '/', '/'], ['ru', '/', '/ru'],
    ['en', '/ru', '/'], ['ru', '/ru', '/ru'],
    ['en', '/rules', '/rules'], ['ru', '/rules', '/ru/rules'],
  ] as const)('%s + %s -> %s', (lang, from, to) => expect(pathForLang(lang, from)).toBe(to));
});

// A hand-typed or mail-client-mangled '/RU/career' is still the Russian page —
// wouter's own base matching is case-insensitive, so accepting it here is what
// keeps the language and the mounted router agreeing.
describe('langFromPath case-insensitivity', () => {
  test.each([
    ['/RU/career', 'ru'], ['/Ru', 'ru'], ['/RULES', 'en'], ['/RUssian', 'en'],
  ])('%s -> %s', (path, lang) => expect(langFromPath(path)).toBe(lang));
});

// The chip's href. A language switch that drops ?utm_source loses the campaign
// that paid for the visit, and one that drops #contact drops the visitor
// somewhere they did not ask to be.
describe('mirrorTarget', () => {
  test('preserves query and hash', () =>
    expect(mirrorTarget('/career', '?utm=x', '#exp')).toBe('~/ru/career?utm=x#exp'));
  test('ru -> en with query', () =>
    expect(mirrorTarget('/ru/loot', '?a=1', '')).toBe('~/loot?a=1'));
  test('bare root', () => expect(mirrorTarget('/', '', '')).toBe('~/ru'));
});
