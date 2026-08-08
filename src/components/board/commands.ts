// The lines the terminal answers by itself — no model, no network. They exist so
// the chat still does something useful when the API is down, rate-limited or out
// of budget for the day, and so the shell has a surface worth exploring.
//
// The registry is data, and its data are dictionary keys, not prose: the shell
// resolves each one through `t` when it prints the line, so the same answers
// come out in whatever language the URL selected. Command names stay
// English on purpose — `whoami` and `ls projects` are the fiction, not copy.
import type { Lang } from '../../i18n/locale';
import {
  CHAPTERS,
  DECLASSIFY_CHAPTER,
  declassify,
  isUnlocked,
  photoSlug,
  takeLoreChapter,
  type ChapterId,
} from './story';

export type CommandResult = {
  textKey: string;
  navigateTo?: string;
  // The language commands cannot name a destination — it is wherever the visitor
  // already is, in the other language. So they declare the language instead, and
  // the shell, the only thing here that knows the current path, resolves it.
  navigateLang?: Lang;
  // A case-file photo to print under the answer. `alt` is a dictionary key, like
  // `textKey` and for the same reason — this file knows no language — so the shape
  // mirrors `ChatMessage.image` without being the same type: that one carries the
  // resolved text, because by then the shell has resolved it.
  image?: { src: string; alt: string };
};

const JOKES = ['commands.joke.1', 'commands.joke.2', 'commands.joke.3', 'commands.joke.4'];
// Module-level, deliberately outside React: a language switch re-renders the
// shell but never re-evaluates this file, so the rotation carries on where it
// left off instead of restarting at the first joke in the other language.
let jokeIx = 0;

// The facts behind these keys are real and checkable — keep them that way.
const LORE = ['commands.lore.1', 'commands.lore.2', 'commands.lore.3', 'commands.lore.4'];
let loreIx = 0;

// A chapter of the /nda case file, addressed by its place in the store's table: the
// dictionary holds the seven in the same order, which content.test.ts pins one for one.
const chapterKey = (id: ChapterId, field: 'story' | 'alt') =>
  `sector.nda.chapters.${CHAPTERS.indexOf(id)}.${field}`;

// The small derivative, and avif alone: this is a thumbnail in a chat log, and the
// full-size photo — where the jpeg fallback earns its place — is one click away in
// the viewer.
const chapterImage = (id: ChapterId) => ({
  src: `/photos/${photoSlug(id)}-640.avif`,
  alt: chapterKey(id, 'alt'),
});

// Canonical commands — the visible surface (command row + /help). Bare unix
// verbs read info, slash commands act; no two entries do the same thing.
const COMMANDS: Record<string, () => CommandResult> = {
  '/help': () => ({ textKey: 'commands.help' }),
  whoami: () => ({ textKey: 'commands.whoami' }),
  'ls projects': () => ({ textKey: 'commands.ls' }),
  '/loadout': () => ({ textKey: 'commands.loadout' }),
  // A cover that has just come off is the news, and news goes before the rotation:
  // the store hands each freshly opened chapter over exactly once, and this is what
  // reads it out — story and photo — before /lore goes back to its own four facts.
  '/lore': () => {
    const fresh = takeLoreChapter();
    return fresh
      ? { textKey: chapterKey(fresh, 'story'), image: chapterImage(fresh) }
      : { textKey: LORE[loreIx++ % LORE.length] };
  },
  '/joke': () => ({ textKey: JOKES[jokeIx++ % JOKES.length] }),
  '/career': () => ({ textKey: 'commands.career', navigateTo: '/career' }),
  '/skills': () => ({ textKey: 'commands.skills', navigateTo: '/skills' }),
  '/nda': () => ({ textKey: 'commands.nda', navigateTo: '/nda' }),
  '/loot': () => ({ textKey: 'commands.loot', navigateTo: '/loot' }),
  '/contact': () => ({ textKey: 'commands.contact', navigateTo: '/contact' }),
  '/3d': () => ({ textKey: 'commands.threed', navigateTo: '/3d' }),
  // The address bar is what picks the language, so switching it is a real
  // navigation — to the mirror of wherever the visitor is standing, never to the
  // root: same sector, other language.
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

// The code the designated file answers to, as a whole word — the same shape the
// store parses, built from the store's own table so the file number is never typed
// out twice.
const CODE = new RegExp(`\\b${DECLASSIFY_CHAPTER}\\b`, 'i');

// ponytail: exact-match registry with one prefix branch beside it; fuzzy matching
// can arrive with a real FAQ corpus if one ever ships
export function runCommand(raw: string): CommandResult | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  // The one command that takes an argument, so it is matched by prefix instead of
  // living in the exact-match registry — and the one that is on neither the row nor
  // /help: the tile it opens is what says VAI knows the code. Typed bare, it is
  // still ours to answer; a visitor who guessed the verb is not asking the model.
  if (key === '/declassify' || key.startsWith('/declassify ')) {
    // The store's lock opens the file once and answers null ever after, including to
    // the code that worked — right for an unlock, wrong for a line of chat, where it
    // would read as the code having stopped working. So a repeat is recognised here
    // and answered exactly as the first time.
    const opened =
      declassify(key) ??
      (CODE.test(key) && isUnlocked(DECLASSIFY_CHAPTER) ? DECLASSIFY_CHAPTER : null);
    return opened
      ? { textKey: 'commands.declassified', image: chapterImage(opened) }
      : { textKey: 'commands.declassifyMiss' };
  }
  const cmd = Object.hasOwn(COMMANDS, key)
    ? COMMANDS[key]
    : Object.hasOwn(ALIASES, key)
      ? ALIASES[key]
      : null;
  return cmd ? cmd() : null;
}
