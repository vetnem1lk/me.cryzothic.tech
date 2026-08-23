// Colour for the /code exhibit: one linear regex pass over a file, returning React
// nodes. A real highlighter is a hundred kilobytes of someone else's grammar tables
// to make our own source look like an editor, and this view is the one place the
// budget is hardest to justify. Two flavours — TS and CSS — and every alternative
// consumes at least one character, so the scan is O(n) with nothing to backtrack into.
//
// ponytail: no regex-literal or JSX awareness. A lone apostrophe inside a regex
// (`/'/`) opens a string that should not be there — bounded to one line, since only
// templates may cross one. A real parser earns its keep only if a file visibly breaks.
import type { ReactNode } from 'react';

// Painted as keywords, not resolved as them: `type`, `of` and `satisfies` are
// contextual in the language and unconditional here. This colours text.
const KEYWORDS = [
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'switch',
  'case', 'break', 'continue', 'new', 'class', 'extends', 'import', 'export', 'from',
  'default', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof',
  'instanceof', 'in', 'of', 'interface', 'type', 'enum', 'implements', 'readonly',
  'public', 'private', 'protected', 'static', 'void', 'null', 'undefined', 'true',
  'false', 'this', 'super', 'yield', 'as', 'satisfies', 'keyof', 'never', 'unknown',
  'any', 'string', 'number', 'boolean', 'object',
];

// Longest first, so `in` cannot claim the head of `instanceof` and leave `stanceof`
// behind. The lookarounds keep the match off identifiers (`constant` is not `const`)
// and off property names, where `object.type` is a field and not a declaration.
const KEYWORD = String.raw`(?<![\w$.])(?:${[...KEYWORDS].sort((a, b) => b.length - a.length).join('|')})(?![\w$])`;

// Written as literals and joined by `.source`, so the escaping is the engine's
// problem rather than a string's. The order is the tie-break at a shared start
// position; in practice only the openers collide, and comments and quotes must win.
const TS_COMMENT = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/;
const TS_STRING = /`(?:\\[\s\S]|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/;
const TS_NUMBER = /\b0[xXbBoO][0-9a-fA-F_]+n?\b|\b\d[\d_]*(?:\.\d[\d_]*)?(?:[eE][+-]?\d+)?n?\b/;

const CSS_COMMENT = /\/\*[\s\S]*?\*\//;
const CSS_STRING = /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/;
const CSS_AT_RULE = /@[\w-]+/;
// Hex colours join the numbers: a stylesheet is mostly measurements and palette.
const CSS_NUMBER = /#[0-9a-fA-F]{3,8}\b|(?<![\w.#-])(?:\d+(?:\.\d+)?|\.\d+)[a-z%]*/;

const TS_RE = new RegExp(
  [TS_COMMENT.source, TS_STRING.source, TS_NUMBER.source, KEYWORD].join('|'),
  'g',
);
const CSS_RE = new RegExp(
  [CSS_COMMENT.source, CSS_STRING.source, CSS_AT_RULE.source, CSS_NUMBER.source].join('|'),
  'g',
);

// The first character already says which alternative fired, so the patterns stay
// free of capture groups. Colours are the site's own tokens: accent for structure,
// mint for text, sand for magnitudes, and comments dimmed rather than tinted.
function classOf(token: string): string {
  const head = token[0];
  if (head === '/') return 'italic text-neutral-500';
  if (head === '"' || head === "'" || head === '`') return 'text-sep-mint';
  if (head === '#' || head === '.' || (head >= '0' && head <= '9')) return 'text-sep-sand';
  return 'text-accent'; // keywords and at-rules
}

/** Tokenizes `source` for the flavour `path`'s extension implies. */
export function highlight(source: string, path: string): ReactNode[] {
  const re = path.endsWith('.css') ? CSS_RE : TS_RE;
  const out: ReactNode[] = [];
  let plainFrom = 0;
  re.lastIndex = 0;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    if (m.index > plainFrom) out.push(source.slice(plainFrom, m.index));
    // The match offset is unique per token, which is exactly what a key has to be.
    out.push(
      <span key={m.index} className={classOf(m[0])}>
        {m[0]}
      </span>,
    );
    plainFrom = re.lastIndex;
  }
  if (plainFrom < source.length) out.push(source.slice(plainFrom));
  return out;
}
