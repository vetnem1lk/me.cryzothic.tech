// The prompt files are gitignored, so no test can ever see the deployed text.
// This script is the only check that does, and it checks two things.
//
// One, it loads the prompts exactly as production boot does, so a lost {{CANARY}}
// or a deflection that collides with the injection screen fails here instead of on
// the box — where systemd's Restart=always turns a boot throw into a crash loop and
// the chat is down site-wide. Mandatory re-run after any gates.ts pattern edit: a
// widened injection screen can start matching a deflection that booted fine
// yesterday.
//
// Two, it enforces what the eval suite assumes and the server does not. All six
// deflect probes in evals/probes.json carry no explicit `match`, so every one of
// them inherits DEFAULT_MATCH.deflect = /\bGAI\b/ (evals/run.mjs) — which makes the
// token a requirement of all four pools, VAI's included. A line rewritten without
// it boots perfectly and turns its probe red in production.
import { loadPrompts } from '../src/prompts.js';

const p = loadPrompts(process.env.PROMPTS_DIR ?? './prompts');
const d = p.deflections;

// filter, not find: an empty line is falsy, so `find` would report "all clear" on
// exactly the pool entry most likely to be a mistake.
const bad = [...d.vai.en, ...d.vai.ru, ...d.gai.en, ...d.gai.ru].filter(
  (l) => !/\bGAI\b/.test(l),
);
if (bad.length) {
  throw new Error(
    `deflection without the literal GAI token (prod probes match /\\bGAI\\b/): ${bad.join(' | ')}`,
  );
}

console.log(
  `BOOT OK ${p.canary} vai en/ru ${d.vai.en.length}/${d.vai.ru.length} gai en/ru ${d.gai.en.length}/${d.gai.ru.length}`,
);
