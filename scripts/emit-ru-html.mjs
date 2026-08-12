// Post-build: derive dist/ru/index.html from dist/index.html so the RU page ships
// a RU head as a static artifact. Crawlers and unfurlers do not run our JS, so a
// React effect that rewrites <title>/canonical/og would be invisible to exactly
// the audience these tags exist for — the swap has to happen at build time.
// Pinned by src/emit-ru-html.test.ts.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// Read-and-parse rather than `import … with { type: 'json' }`: this build also runs
// on older Node, and JSON import attributes are only stable since 22.12.
const content = JSON.parse(readFileSync(new URL('../src/content.json', import.meta.url), 'utf8'));

const ORIGIN = 'https://me.cryzothic.tech';

// String.replace returns its input unchanged on a miss, so a reformatted head
// would quietly emit a half-English page instead of failing the build.
const sub = (html, pattern, to) => {
  const out = html.replace(pattern, to);
  if (out === html) throw new Error(`emit-ru-html: no match for ${pattern}`);
  return out;
};

// `\s+`, not a single space: the head is prettier-wrapped, so the longer <meta>
// tags carry a newline and indentation between their attributes. The replacement
// is a function, not a `$1…` string, so a dictionary value containing `$&` or `$1`
// lands verbatim instead of being read as a backreference.
const meta = (selector, value) => [
  new RegExp(`(<meta\\s+${selector}\\s+content=")[^"]*`),
  (_, open) => open + value,
];

/** Swap every EN-specific head value for its RU twin; everything else (the
 *  hreflang block above all) copies through byte-identical. */
export function toRuHtml(html, m = content.ru.meta) {
  return [
    ['<html lang="en"', '<html lang="ru"'],
    [/<title>[^<]*<\/title>/, () => `<title>${m.title}</title>`],
    [/(<link\s+rel="canonical"\s+href=")[^"]*/, `$1${ORIGIN}/ru/`],
    meta('name="description"', m.description),
    meta('property="og:url"', `${ORIGIN}/ru/`),
    meta('property="og:title"', m.title),
    meta('property="og:description"', m.ogDescription),
    meta('property="og:image"', `${ORIGIN}/og-ru.png`),
    // Reverse pair of the EN file. Anchored on the closing quote so `og:locale`
    // cannot match `og:locale:alternate` (same for og:image vs og:image:width).
    meta('property="og:locale"', 'ru_RU'),
    meta('property="og:locale:alternate"', 'en_US'),
    // X reads twitter:image in preference to og:image — leaving it would unfurl
    // the English card on the Russian page.
    meta('name="twitter:image"', `${ORIGIN}/og-ru.png`),
  ].reduce((acc, [pattern, to]) => sub(acc, pattern, to), html);
}

if (process.argv[1]?.endsWith('emit-ru-html.mjs')) {
  const dist = new URL('../dist/', import.meta.url);
  const en = readFileSync(new URL('index.html', dist), 'utf8');
  mkdirSync(new URL('ru/', dist), { recursive: true });
  writeFileSync(new URL('ru/index.html', dist), toRuHtml(en));
  console.log('[emit-ru-html] dist/ru/index.html written');
}
