// Pins the local command surface: every command on the visible row resolves to a
// dictionary key that exists in both languages, hidden aliases land on the same
// result, and unknown input returns null — the signal the terminal reads as
// "this one is for the model".
import { beforeEach, describe, expect, it } from 'vitest';
import content from '../../content.json';
import { translate } from '../../i18n/I18nContext';
import { COMMAND_ROW, ROUTE_PATHS, runCommand } from './commands';
import {
  CHAPTERS,
  DECLASSIFY_CHAPTER,
  QUESTS,
  guess,
  isUnlocked,
  photoSlug,
  resetStory,
} from './story';

// The story store is module state, and this file opens files in it: without a reset
// a chapter left in the lore queue would be read out by the next test's /lore.
beforeEach(() => resetStory());

describe('runCommand', () => {
  it('answers a known verb', () => {
    expect(runCommand('whoami')?.textKey).toBe('commands.whoami');
  });
  it('normalizes case and whitespace', () => {
    expect(runCommand('  LS   Projects ')).not.toBeNull();
  });
  it('navigation commands carry a route', () => {
    expect(runCommand('/loot')).toMatchObject({ navigateTo: '/loot' });
  });
  it('language commands declare a language, never a path', () => {
    // Exact objects, not toMatchObject: a navigateTo smuggled back in here would
    // be a fixed destination, and the spec says these two mirror the path the
    // visitor is standing on. Only the shell knows that path.
    expect(runCommand('/en')).toEqual({ textKey: 'commands.en', navigateLang: 'en' });
    expect(runCommand('/ru')).toEqual({ textKey: 'commands.ru', navigateLang: 'ru' });
  });
  it('hidden aliases still resolve', () => {
    expect(runCommand('cat resume')).toMatchObject({ navigateTo: '/loot' });
    expect(runCommand('contact')).toMatchObject({ navigateTo: '/contact' });
    expect(runCommand('help')?.textKey).toBe(runCommand('/help')?.textKey);
  });
  it('unknown input returns null (falls through to transport)', () => {
    expect(runCommand('tell me about vlad')).toBeNull();
  });
  // The registry is a plain object literal, so every key on Object.prototype is
  // reachable through it by inheritance. `Object.hasOwn` is what keeps the lookup
  // to the twenty-odd commands actually written down: `key in COMMANDS` would
  // answer '__proto__' with the prototype itself and 'constructor' with a function
  // that returns `{}` — one throws on call, the other prints a line nobody wrote.
  it('inherited keys are not commands', () => {
    expect(runCommand('__proto__')).toBeNull();
    expect(runCommand('constructor')).toBeNull();
    expect(runCommand('/__proto__')).toBeNull();
  });
  it('jokes rotate', () => {
    expect(runCommand('/joke')?.textKey).not.toBe(runCommand('/joke')?.textKey);
  });
  it('lore rotates', () => {
    expect(runCommand('/lore')?.textKey).not.toBe(runCommand('/lore')?.textKey);
  });
  it('every row command resolves', () => {
    for (const c of COMMAND_ROW) expect(runCommand(c)).not.toBeNull();
  });
  // The registry holds keys, not prose: a typo would ship the key itself to the
  // screen, because useT passes an unknown key straight through. That passthrough
  // is also the assertion — translate() hands back the key on a miss, and on a key
  // that points at a branch of the dictionary rather than a string.
  it('every text key resolves in both languages', () => {
    // Three extra spins each: /joke and /lore rotate, so a single pass would only
    // ever check whichever of the four the counter happens to be on. Four
    // consecutive calls cover all four whatever it starts at.
    const spins = ['/joke', '/joke', '/joke', '/lore', '/lore', '/lore'];
    for (const c of [...COMMAND_ROW, 'help', 'cat resume', 'contact', ...spins]) {
      const key = runCommand(c)!.textKey;
      for (const lang of ['en', 'ru'] as const)
        expect(translate(lang, key), `${lang}:${key}`).not.toBe(key);
    }
  });
  // /help is hand-written, not generated — it groups the sector jumps on one line.
  // This is what keeps it from drifting away from the registry anyway.
  it('help names every row command, in both languages', () => {
    for (const lang of ['en', 'ru'] as const)
      for (const c of COMMAND_ROW)
        expect(content[lang].commands.help, `${lang}:${c}`).toContain(c);
  });
  it('row has no functional duplicates (unique routes, unique names)', () => {
    expect(COMMAND_ROW).toEqual([
      '/help',
      'whoami',
      'ls projects',
      '/loadout',
      '/lore',
      '/joke',
      '/career',
      '/skills',
      '/nda',
      '/loot',
      '/contact',
      '/3d',
      '/code',
      '/en',
      '/ru',
    ]);
    // Seven fixed destinations, all distinct. /en and /ru are absent on purpose:
    // they carry a language, not a path, so there is nothing here to collide.
    const routes = COMMAND_ROW.map((c) => runCommand(c)?.navigateTo).filter(Boolean);
    expect(routes).toHaveLength(7);
    expect(new Set(routes).size).toBe(routes.length);
  });
});

// The route table the Stage mounts and the destinations these commands name are one
// list now. These two pins are what that buys: the language can never leak into a
// path, and a sector can never be reachable from the shell but absent from the router.
describe('ROUTE_PATHS', () => {
  it('never carries a language prefix', () => {
    // Case-folded like locale.ts reads it back: wouter matches the router base
    // case-insensitively, so a '/RU/…' route would mount the Russian router and
    // be exactly as wrong as the lower-case one.
    for (const p of ROUTE_PATHS) {
      const q = p.toLowerCase();
      expect(q === '/ru' || q.startsWith('/ru/'), p).toBe(false);
    }
    // Non-vacuous: an emptied list would satisfy the loop above in silence.
    expect(ROUTE_PATHS).toContain('/nda');
  });

  it('holds every destination the commands name, and nothing else', () => {
    const routes = COMMAND_ROW.map((c) => runCommand(c)?.navigateTo).filter(
      (r): r is string => !!r,
    );
    // Set-equal both ways: a route the shell cannot reach is as much a drift as a
    // command pointing at a sector the router will not mount. `cat resume` is the
    // one alias with a destination and it is /loot, already on the list.
    expect([...new Set(routes)].sort()).toEqual([...ROUTE_PATHS].sort());
  });
});

// The two commands that reach into the /nda story: one opens a file, the other reads
// out whatever has been opened. Both answer with a photo, and neither names a file
// number here — the store's quest table is what says which chapter is which.
describe('the story commands', () => {
  const GUESS = CHAPTERS.find((c) => QUESTS[c] === 'guess') as (typeof CHAPTERS)[number];

  const resolves = (key: string) => {
    for (const lang of ['en', 'ru'] as const)
      expect(translate(lang, key), `${lang}:${key}`).not.toBe(key);
  };

  it('/declassify stays hidden — off the command row and out of /help', () => {
    expect(COMMAND_ROW.some((c) => c.includes('declassify'))).toBe(false);
    for (const lang of ['en', 'ru'] as const)
      expect(content[lang].commands.help, lang).not.toContain('declassify');
  });

  it('opens the one designated file, and answers the same way when asked twice', () => {
    const first = runCommand(`/declassify ${DECLASSIFY_CHAPTER.toLowerCase()}`);
    expect(first?.textKey).toBe('commands.declassified');
    // Exact: the log gets the small derivative, not the one the viewer loads.
    expect(first?.image?.src).toBe(`/photos/${photoSlug(DECLASSIFY_CHAPTER)}-640.avif`);
    expect(isUnlocked(DECLASSIFY_CHAPTER)).toBe(true);
    // The store's lock answers once and then null for good, which is right for an
    // unlock and wrong for a line of chat: asking again is not a mistake.
    expect(runCommand(`/declassify ${DECLASSIFY_CHAPTER}`)).toEqual(first);
  });

  it('refuses every other code — working ones included — and opens nothing', () => {
    const other = CHAPTERS.find((c) => c !== DECLASSIFY_CHAPTER);
    for (const raw of [`/declassify ${other}`, '/declassify file-99', '/declassify']) {
      const r = runCommand(raw);
      expect(r?.textKey, raw).toBe('commands.declassifyMiss');
      expect(r?.image, raw).toBeUndefined();
    }
    expect(CHAPTERS.some(isUnlocked)).toBe(false);
  });

  it('/lore reads a freshly opened file before returning to its rotation', () => {
    guess(GUESS);
    const r = runCommand('/lore');
    expect(r?.textKey).toBe(`sector.nda.chapters.${CHAPTERS.indexOf(GUESS)}.story`);
    expect(r?.image?.src).toContain(photoSlug(GUESS));
    // Queue drained: the next one is a lore drop again, and a lore drop has no photo.
    expect(runCommand('/lore')?.image).toBeUndefined();
  });

  it('every string these two answer with resolves in both languages', () => {
    guess(GUESS);
    const lore = runCommand('/lore');
    // The chapter keys carry an array index — content.json's chapters are a list,
    // and the resolver walks it like any other object. That is the pin.
    resolves(lore!.textKey);
    resolves(lore!.image!.alt);
    const opened = runCommand(`/declassify ${DECLASSIFY_CHAPTER}`);
    resolves(opened!.textKey);
    resolves(opened!.image!.alt);
    resolves(runCommand('/declassify')!.textKey);
  });
});
