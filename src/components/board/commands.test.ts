// Pins the local command surface: every command on the visible row resolves,
// hidden aliases land on the same result, and unknown input returns null — the
// signal the terminal reads as "this one is for the model".
import { describe, expect, it } from 'vitest';
import { COMMAND_ROW, runCommand } from './commands';

describe('runCommand', () => {
  it('answers a known verb', () => {
    expect(runCommand('whoami')?.text).toMatch(/Klimentev/);
  });
  it('normalizes case and whitespace', () => {
    expect(runCommand('  LS   Projects ')).not.toBeNull();
  });
  it('navigation commands carry a route', () => {
    expect(runCommand('/loot')).toMatchObject({ navigateTo: '/loot' });
  });
  it('hidden aliases still resolve', () => {
    expect(runCommand('cat resume')).toMatchObject({ navigateTo: '/loot' });
    expect(runCommand('contact')).toMatchObject({ navigateTo: '/contact' });
    expect(runCommand('help')?.text).toBe(runCommand('/help')?.text);
  });
  it('unknown input returns null (falls through to transport)', () => {
    expect(runCommand('tell me about vlad')).toBeNull();
  });
  it('jokes rotate', () => {
    expect(runCommand('/joke')?.text).not.toBe(runCommand('/joke')?.text);
  });
  it('lore rotates', () => {
    expect(runCommand('/lore')?.text).not.toBe(runCommand('/lore')?.text);
  });
  it('every row command resolves', () => {
    for (const c of COMMAND_ROW) expect(runCommand(c)).not.toBeNull();
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
    ]);
    const routes = COMMAND_ROW.map((c) => runCommand(c)?.navigateTo).filter(Boolean);
    expect(new Set(routes).size).toBe(routes.length);
  });
});
