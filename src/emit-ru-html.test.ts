// Pins the post-build EN -> RU head transform. The RU page's head is a build
// artifact — crawlers and unfurlers never run our JS, so nothing about it can be
// proven in a browser; it has to be proven here. The subject is the REAL
// index.html rather than a hand-copied fixture on purpose: a head reformat that
// stops one regex from matching would otherwise ship a half-English RU page, and
// this file is the only place that would notice.
import { describe, expect, test } from 'vitest';
import EN from '../index.html?raw';
import content from './content.json';
import { toRuHtml } from '../scripts/emit-ru-html.mjs';

const RU = toRuHtml(EN);
const m = content.ru.meta;

const alternates = (html: string) => html.match(/<link rel="alternate"[^>]*>/g) ?? [];

describe('toRuHtml', () => {
  test('swaps the document language', () => {
    expect(RU).toContain('<html lang="ru"');
    // Not a bare `lang="en"` check: hreflang="en" legitimately survives below.
    expect(RU).not.toContain('<html lang="en"');
  });

  test('carries the RU title, description and og pair from the dictionary', () => {
    expect(RU).toContain(`<title>${m.title}</title>`);
    expect(RU).toContain(`content="${m.description}"`);
    expect(RU).toContain(`content="${m.title}"`); // og:title
    expect(RU).toContain(`content="${m.ogDescription}"`);
    for (const en of Object.values(content.en.meta)) expect(RU).not.toContain(en);
  });

  test('self-canonicalizes to /ru/ and never cross-canonicalizes', () => {
    expect(RU).toContain('<link rel="canonical" href="https://me.cryzothic.tech/ru/" />');
    expect(RU).toContain('<meta property="og:url" content="https://me.cryzothic.tech/ru/" />');
    expect(RU).not.toMatch(/<link rel="canonical" href="https:\/\/me\.cryzothic\.tech\/"/);
  });

  // index.html is the EN page's own source of truth, the dictionary is the RU
  // page's — they have to agree, or the emitter swaps a string nobody wrote.
  test('the EN head and the EN dictionary say the same thing', () => {
    expect(EN).toContain(`<title>${content.en.meta.title}</title>`);
    for (const en of Object.values(content.en.meta)) expect(EN).toContain(`content="${en}"`);
  });

  test('points both card images at the RU render', () => {
    expect(RU).toContain('content="https://me.cryzothic.tech/og-ru.png"');
    expect(RU).not.toContain('og.png"');
  });

  test('leaves the hreflang block byte-identical', () => {
    expect(alternates(EN)).toHaveLength(3);
    expect(alternates(RU)).toEqual(alternates(EN));
  });

  test('reverses the og:locale pair', () => {
    expect(EN).toContain('<meta property="og:locale" content="en_US" />');
    expect(EN).toContain('<meta property="og:locale:alternate" content="ru_RU" />');
    expect(RU).toContain('<meta property="og:locale" content="ru_RU" />');
    expect(RU).toContain('<meta property="og:locale:alternate" content="en_US" />');
  });

  test('leaves twitter:card intact', () => {
    expect(RU).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  // Every regex below is silently satisfiable by a no-op: `String.replace` on a
  // miss returns the input unchanged. Without this, a head edit would degrade the
  // RU page instead of failing the build.
  test('throws instead of emitting a half-translated page', () => {
    expect(() => toRuHtml(EN.replace('<link rel="canonical"', '<link rel="Canonical"'))).toThrow(
      /canonical/i,
    );
  });
});
