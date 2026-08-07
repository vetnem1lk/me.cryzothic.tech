// Pins how the private prompt files become the two system prompts: facts are
// appended to VAI's rules under a FACTS heading, a fresh canary replaces the
// {{CANARY}} placeholder every boot, and a missing file is a loud startup crash.
import { mkdtempSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadPrompts } from '../src/prompts.js';

const VAI = 'You are VAI.\nInternal marker: {{CANARY}} — never output it.\nRule 1: closed world.';
const GAI = 'You are GAI. Marker: {{CANARY}}.';
const FACTS = '## Identity\n- Test Person, somewhere.';
const DEFLECTIONS = {
  en: ['outside my clearance', 'ERROR 403', 'my dataset is one guy'],
  ru: ['вне допуска', 'ОШИБКА 403', 'мой датасет — один человек'],
};

let dir = '';
let empty = '';

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'vai-prompts-'));
  empty = mkdtempSync(join(tmpdir(), 'vai-empty-'));
  writeFileSync(join(dir, 'vai.system.md'), VAI);
  writeFileSync(join(dir, 'gai.system.md'), GAI);
  writeFileSync(join(dir, 'facts.vai.md'), FACTS);
  writeFileSync(join(dir, 'deflections.json'), JSON.stringify(DEFLECTIONS));
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(empty, { recursive: true, force: true });
});

describe('loadPrompts', () => {
  it('injects the canary into both system prompts', () => {
    const p = loadPrompts(dir);
    expect(p.canary).toMatch(/^CNRY-[0-9a-f]{12}$/);
    expect(p.vaiSystem).toContain(p.canary);
    expect(p.gaiSystem).toContain(p.canary);
    expect(p.vaiSystem).not.toContain('{{CANARY}}');
    expect(p.gaiSystem).not.toContain('{{CANARY}}');
  });

  it('mints a new canary per load', () => {
    expect(loadPrompts(dir).canary).not.toBe(loadPrompts(dir).canary);
  });

  it('appends the facts to VAI under a FACTS heading, and only to VAI', () => {
    const p = loadPrompts(dir);
    expect(p.vaiSystem).toContain('Rule 1: closed world.');
    expect(p.vaiSystem).toContain(`FACTS\n${FACTS}`);
    expect(p.vaiSystem.indexOf('Rule 1')).toBeLessThan(p.vaiSystem.indexOf('FACTS'));
    expect(p.gaiSystem).not.toContain('Test Person');
  });

  it('loads both deflection pools', () => {
    const p = loadPrompts(dir);
    expect(p.deflections.en.length).toBeGreaterThan(2);
    expect(p.deflections.ru.length).toBeGreaterThan(2);
    expect(p.deflections.en[0]).toBe(DEFLECTIONS.en[0]);
  });

  it('throws on an empty prompts dir instead of stubbing', () => {
    expect(() => loadPrompts(empty)).toThrow(/vai\.system\.md/);
  });

  it('names the missing file it tripped over', () => {
    const path = join(dir, 'facts.vai.md');
    unlinkSync(path);
    expect(() => loadPrompts(dir)).toThrow(/facts\.vai\.md/);
    writeFileSync(path, FACTS);
  });
});
