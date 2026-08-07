// Loads the four private prompt files (see prompts/README.md — never committed)
// and mints a per-boot canary: a marker planted in the system prompts that the
// chat route watches for in model output to catch a prompt leak.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// No cycle: gates.ts imports only `type` from here, and a type import is erased.
import { screenInjection } from './gates.js';

type DeflectionPools = { en: string[]; ru: string[] };

export interface Prompts {
  vaiSystem: string;
  gaiSystem: string;
  canary: string;
  // Per mode, because the two deflect for different reasons: VAI's topic gate says
  // "not my dataset, ask GAI", while GAI only ever deflects on an injection and has
  // nowhere to send anyone.
  deflections: { vai: DeflectionPools; gai: DeflectionPools };
}

export function loadPrompts(dir: string): Prompts {
  // readFileSync throws ENOENT naming the file it wanted: a missing prompt has to
  // kill the boot loudly, never degrade into an ungrounded agent.
  const read = (name: string) => readFileSync(join(dir, name), 'utf8');
  const canary = `CNRY-${randomBytes(6).toString('hex')}`;
  const plant = (template: string) => template.replaceAll('{{CANARY}}', canary);

  // VAI's grounding corpus is a separate file so facts can be redeployed without
  // touching the rules; the rules reference it as "the FACTS section".
  const vaiSystem = plant(`${read('vai.system.md')}\n\nFACTS\n${read('facts.vai.md')}`);
  const gaiSystem = plant(read('gai.system.md'));
  // The prompts are hand-edited and private, so nothing else would notice a lost
  // placeholder: the plant silently does nothing, the canary is in no prompt, and
  // the leak filter spends the deploy watching for a marker the model has never
  // seen. Every test stays green while the guardrail is dead.
  if (!vaiSystem.includes(canary) || !gaiSystem.includes(canary)) {
    throw new Error(
      'a system prompt is missing its {{CANARY}} placeholder — the leak filter would be dead',
    );
  }

  // The flat `{en,ru}` shape predates the per-mode pools. Code reaches the box
  // through git and this file through scp, so a deploy has a window where the two
  // disagree — and with Restart=always a boot throw is a crash loop that takes the
  // chat down site-wide. One release of shape tolerance costs one line — delete it
  // once the box file is nested, i.e. after the first restart following the T5b
  // prompts scp. Past that point a flat file on the box is a mistake, not a
  // migration, and should fail loudly.
  const raw = JSON.parse(read('deflections.json')) as Prompts['deflections'] | DeflectionPools;
  const deflections: Prompts['deflections'] = 'vai' in raw ? raw : { vai: raw, gai: raw };
  // A deflection comes back to us as an assistant turn in the replayed history,
  // where a screen hit drops the turn. A colliding line is therefore not a
  // deflection that fails — it is one turn of memory quietly lost from every
  // conversation that was ever deflected. Cheaper to catch at boot than to
  // explain later. GAI's pool is the likelier offender: its lines talk *about*
  // persona swaps, which is the wording the screen hunts for.
  const colliding = [
    ...deflections.vai.en,
    ...deflections.vai.ru,
    ...deflections.gai.en,
    ...deflections.gai.ru,
  ].find(screenInjection);
  if (colliding) {
    throw new Error(`a deflection trips the injection screen — rephrase it: ${colliding}`);
  }

  return { vaiSystem, gaiSystem, canary, deflections };
}
