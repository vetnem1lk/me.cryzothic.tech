// Pins the local command surface: every command on the visible row resolves to a
// dictionary key that exists in both languages, hidden aliases land on the same
// result, and unknown input returns null — the signal the terminal reads as
// "this one is for the model".
import { describe, expect, it } from 'vitest';
import content from '../../content.json';
import { translate } from '../../i18n/I18nContext';
import { COMMAND_ROW, runCommand } from './commands';

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
      '/en',
      '/ru',
    ]);
    // Six fixed destinations, all distinct. /en and /ru are absent on purpose:
    // they carry a language, not a path, so there is nothing here to collide.
    const routes = COMMAND_ROW.map((c) => runCommand(c)?.navigateTo).filter(Boolean);
    expect(routes).toHaveLength(6);
    expect(new Set(routes).size).toBe(routes.length);
  });
});
