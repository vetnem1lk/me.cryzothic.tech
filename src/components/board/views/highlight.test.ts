// Pins the /code exhibit's tokenizer: what it paints, and — the half that actually
// breaks — what it leaves alone. A highlighter that eats a character is worse than
// none at all in a view whose whole claim is that the source is shown verbatim, so
// every case here also asserts the round trip back to the input string.
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { highlight } from './highlight';

type Span = ReactElement<{ className: string; children: string }>;

/** The painted tokens, in order, as `class → text`. */
function painted(source: string, path = 'x.ts'): [string, string][] {
  const nodes = highlight(source, path);
  expect(nodes.map((n) => (typeof n === 'string' ? n : (n as Span).props.children)).join('')).toBe(
    source,
  );
  return nodes
    .filter((n) => typeof n !== 'string')
    .map((n) => [(n as Span).props.className, (n as Span).props.children]);
}

const text = (source: string, path?: string) => painted(source, path).map(([, t]) => t);

describe('TypeScript flavour', () => {
  it('keeps an escaped quote inside its string', () => {
    expect(text(String.raw`const s = 'it\'s fine';`)).toEqual(['const', String.raw`'it\'s fine'`]);
  });

  it('carries a template literal across lines', () => {
    expect(text('const t = `one\ntwo`;\nlet n = 1;')).toEqual([
      'const',
      '`one\ntwo`',
      'let',
      '1',
    ]);
  });

  it('takes line and block comments whole, keywords inside them included', () => {
    expect(text('/* const a */\n// return b\nlet c;')).toEqual([
      '/* const a */',
      '// return b',
      'let',
    ]);
  });

  it('refuses a keyword that is only the head of an identifier', () => {
    expect(text('const constant = constConst;')).toEqual(['const']);
  });

  it('leaves a property name alone but paints the declaration', () => {
    expect(text('const k = obj.type;')).toEqual(['const']);
  });

  it('paints comments dim, strings mint, numbers sand and keywords accent', () => {
    expect(painted("// a\nconst n = 0x1f, s = 'b';")).toEqual([
      ['italic text-neutral-500', '// a'],
      ['text-accent', 'const'],
      ['text-sep-sand', '0x1f'],
      ['text-sep-mint', "'b'"],
    ]);
  });
});

describe('CSS flavour', () => {
  it('paints comments, at-rules, hex colours and measurements', () => {
    expect(painted('/* c */\n@media (min-width: 48rem) {\n  --x: #b497cf;\n}', 'a.css')).toEqual([
      ['italic text-neutral-500', '/* c */'],
      ['text-accent', '@media'],
      ['text-sep-sand', '48rem'],
      ['text-sep-sand', '#b497cf'],
    ]);
  });

  it('does not read TypeScript comments or keywords in a stylesheet', () => {
    expect(text('.a { /* const */ color: red; } // not a css comment', 'a.css')).toEqual([
      '/* const */',
    ]);
  });
});
