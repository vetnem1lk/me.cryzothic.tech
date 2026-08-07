// Loads the four private prompt files (see prompts/README.md — never committed)
// and mints a per-boot canary: a marker planted in the system prompts that the
// chat route watches for in model output to catch a prompt leak.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Prompts {
  vaiSystem: string;
  gaiSystem: string;
  canary: string;
  deflections: { en: string[]; ru: string[] };
}

export function loadPrompts(dir: string): Prompts {
  // readFileSync throws ENOENT naming the file it wanted: a missing prompt has to
  // kill the boot loudly, never degrade into an ungrounded agent.
  const read = (name: string) => readFileSync(join(dir, name), 'utf8');
  const canary = `CNRY-${randomBytes(6).toString('hex')}`;
  const plant = (template: string) => template.replaceAll('{{CANARY}}', canary);

  return {
    // VAI's grounding corpus is a separate file so facts can be redeployed
    // without touching the rules; the rules reference it as "the FACTS section".
    vaiSystem: plant(`${read('vai.system.md')}\n\nFACTS\n${read('facts.vai.md')}`),
    gaiSystem: plant(read('gai.system.md')),
    canary,
    deflections: JSON.parse(read('deflections.json')) as Prompts['deflections'],
  };
}
