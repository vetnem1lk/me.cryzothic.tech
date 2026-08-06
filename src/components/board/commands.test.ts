import { describe, expect, it } from 'vitest';
import { runCommand } from './commands';

describe('runCommand', () => {
  it('answers a known verb', () => {
    expect(runCommand('whoami')?.text).toMatch(/Klimentev/);
  });
  it('normalizes case and whitespace', () => {
    expect(runCommand('  LS   Projects ')).not.toBeNull();
  });
  it('navigation commands carry a route', () => {
    expect(runCommand('cat resume')).toMatchObject({ navigateTo: '/loot' });
  });
  it('unknown input returns null (falls through to transport)', () => {
    expect(runCommand('tell me about vlad')).toBeNull();
  });
  it('jokes rotate', () => {
    expect(runCommand('/joke')?.text).not.toBe(runCommand('/joke')?.text);
  });
});
