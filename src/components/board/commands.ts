// The lines the terminal answers by itself — no model, no network. They exist so
// the chat still does something useful when the API is down, rate-limited or out
// of budget for the day, and so the shell has a surface worth exploring.
//
// The registry is data, and its data are dictionary keys, not prose: the shell
// resolves each one through `t` when it prints the line, so the same answers
// come out in whatever language the URL selected. Command names stay
// English on purpose — `whoami` and `ls projects` are the fiction, not copy.
import type { Lang } from '../../i18n/locale';

export type CommandResult = {
  textKey: string;
  navigateTo?: string;
  // The language commands cannot name a destination — it is wherever the visitor
  // already is, in the other language. So they declare the language instead, and
  // the shell, the only thing here that knows the current path, resolves it.
  navigateLang?: Lang;
};

const JOKES = ['commands.joke.1', 'commands.joke.2', 'commands.joke.3', 'commands.joke.4'];
// Module-level, deliberately outside React: a language switch re-renders the
// shell but never re-evaluates this file, so the rotation carries on where it
// left off instead of restarting at the first joke in the other language.
let jokeIx = 0;

// The facts behind these keys are real and checkable — keep them that way.
const LORE = ['commands.lore.1', 'commands.lore.2', 'commands.lore.3', 'commands.lore.4'];
let loreIx = 0;

// Canonical commands — the visible surface (command row + /help). Bare unix
// verbs read info, slash commands act; no two entries do the same thing.
const COMMANDS: Record<string, () => CommandResult> = {
  '/help': () => ({ textKey: 'commands.help' }),
  whoami: () => ({ textKey: 'commands.whoami' }),
  'ls projects': () => ({ textKey: 'commands.ls' }),
  '/loadout': () => ({ textKey: 'commands.loadout' }),
  '/lore': () => ({ textKey: LORE[loreIx++ % LORE.length] }),
  '/joke': () => ({ textKey: JOKES[jokeIx++ % JOKES.length] }),
  '/career': () => ({ textKey: 'commands.career', navigateTo: '/career' }),
  '/skills': () => ({ textKey: 'commands.skills', navigateTo: '/skills' }),
  '/nda': () => ({ textKey: 'commands.nda', navigateTo: '/nda' }),
  '/loot': () => ({ textKey: 'commands.loot', navigateTo: '/loot' }),
  '/contact': () => ({ textKey: 'commands.contact', navigateTo: '/contact' }),
  '/3d': () => ({ textKey: 'commands.threed', navigateTo: '/3d' }),
  // The address bar is what picks the language, so switching it is a real
  // navigation — to the mirror of wherever the visitor is standing, never to the
  // root: same sector, other language (spec §T5c decision 5).
  '/en': () => ({ textKey: 'commands.en', navigateLang: 'en' }),
  '/ru': () => ({ textKey: 'commands.ru', navigateLang: 'ru' }),
};

// Hidden aliases — accepted when typed, never listed (no visible duplicates).
const ALIASES: Record<string, () => CommandResult> = {
  help: COMMANDS['/help'],
  'cat resume': () => ({ textKey: 'commands.catResume', navigateTo: '/loot' }),
  contact: COMMANDS['/contact'],
};

// Ordered list for the command row; insertion order above is the display order.
export const COMMAND_ROW = Object.keys(COMMANDS);

// ponytail: exact-match registry; fuzzy matching/args arrive with the FAQ corpus (T6)
export function runCommand(raw: string): CommandResult | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  const cmd = Object.hasOwn(COMMANDS, key)
    ? COMMANDS[key]
    : Object.hasOwn(ALIASES, key)
      ? ALIASES[key]
      : null;
  return cmd ? cmd() : null;
}
