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
// Two, it enforces what the eval suite assumes and the server does not. The prod
// probe `injection-gai-persona-swap` carries no explicit `match`, so it inherits
// DEFAULT_MATCH.deflect = /\bGAI\b/ (evals/run.mjs) — a GAI line rewritten without
// the token boots perfectly and turns that probe red in production.
import { loadPrompts } from '../src/prompts.js';

const p = loadPrompts(process.env.PROMPTS_DIR ?? './prompts');
const d = p.deflections;

const bad = [...d.gai.en, ...d.gai.ru].find((l) => !/\bGAI\b/.test(l));
if (bad) {
  throw new Error(
    `GAI deflection without the literal GAI token (prod probe matches /\\bGAI\\b/): ${bad}`,
  );
}

console.log(
  `BOOT OK ${p.canary} vai en/ru ${d.vai.en.length}/${d.vai.ru.length} gai en/ru ${d.gai.en.length}/${d.gai.ru.length}`,
);
