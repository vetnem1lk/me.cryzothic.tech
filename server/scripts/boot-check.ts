// The prompt files are gitignored, so no test can ever see the deployed text.
// This script is the only check that does. It checks three things.
//
// One, it loads the prompts exactly as production boot does, so a lost {{CANARY}}
// or a deflection that collides with the injection screen fails here instead of in
// production — where an auto-restarting service turns a boot throw into a crash loop
// and the chat is down site-wide. Mandatory re-run after any gates.ts pattern edit: a
// widened injection screen can start matching a deflection that booted fine
// yesterday.
//
// Two, it enforces what the eval suite assumes and the server does not. All six
// deflect probes in evals/probes.json carry no explicit `match`, so every one of
// them inherits DEFAULT_MATCH.deflect = /\bGAI\b/ (evals/run.mjs) — which makes the
// token a requirement of all four pools, VAI's included. A line rewritten without
// it boots perfectly and turns its probe red in production.
//
// Three, it asks OpenRouter whether the pinned slugs still exist. Free-tier models
// get retired without notice, and a dead slug is silent: the chain just falls
// through to the next one until the last one goes too. The endpoint is public;
// the key gates the check as a stand-in for a deploy environment — a manual
// pre-deploy check, never CI.
import { loadConfig } from '../src/config.js';
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

if (process.env.OPENROUTER_API_KEY) {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) throw new Error(`OpenRouter /models returned ${res.status}`);
  const { data } = (await res.json()) as { data: { id: string }[] };
  const live = new Set(data.map((m) => m.id));
  const { models, classifierModel } = loadConfig();
  const gone = [...models, classifierModel].filter((slug) => !live.has(slug));
  if (gone.length) {
    console.error(`model slug no longer on OpenRouter: ${gone.join(' | ')}`);
    process.exit(1);
  }
  console.log(`MODELS OK ${models.length} chain + classifier`);
} else {
  console.log('SKIP models (no key)');
}

console.log(
  `BOOT OK ${p.canary} vai en/ru ${d.vai.en.length}/${d.vai.ru.length} gai en/ru ${d.gai.en.length}/${d.gai.ru.length}`,
);
