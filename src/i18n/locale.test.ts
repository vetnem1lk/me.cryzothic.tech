// Pins the URL<->language contract: which paths are Russian, which browser
// languages open in Russian, and how a path maps to its twin in the other
// language. '/rules' and '/russian' are the traps — they must stay English.
import { describe, expect, test } from 'vitest';
import { langFromPath, mirrorPath, pickInitialLocale } from './locale';

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
