// Pins the runtime env contract: never boot keyless against a paid API, never let
// an empty `PORT=` line in a .env silently rebind the port, and keep the model
// fallback chain frozen so a typo in a slug fails here and not in production.
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const CHAIN = [
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'openai/gpt-oss-20b:free',
];

describe('loadConfig', () => {
  it('refuses to boot without an API key', () => {
    expect(() => loadConfig({})).toThrow(/OPENROUTER_API_KEY/);
    expect(() => loadConfig({ OPENROUTER_API_KEY: '' })).toThrow(/OPENROUTER_API_KEY/);
  });

  it('boots keyless in mock mode', () => {
    const c = loadConfig({ MOCK_LLM: '1' });
    expect(c.mockLlm).toBe(true);
    expect(c.apiKey).toBe('');
  });

  it('keeps the model chain and classifier frozen', () => {
    const c = loadConfig({ MOCK_LLM: '1' });
    expect(c.models).toEqual(CHAIN);
    expect(c.classifierModel).toBe('google/gemma-4-26b-a4b-it:free');
  });

  it('stays within the OpenRouter limit of 3 models per request', () => {
    // A fourth entry is not a degraded fallback, it is a hard 400 from OpenRouter
    // ("'models' array must have 3 items or fewer") on *every* chat request —
    // and the unit suite injects fetch, so nothing else here would ever see it.
    // This pin makes that mistake fail offline instead of in production.
    expect(loadConfig({ MOCK_LLM: '1' }).models.length).toBeLessThanOrEqual(3);
  });

  it('applies defaults when nothing is set', () => {
    const c = loadConfig({ OPENROUTER_API_KEY: 'k' });
    expect(c.port).toBe(13331);
    expect(c.dailyCap).toBe(450);
    expect(c.promptsDir).toBe('./prompts');
    expect(c.mockLlm).toBe(false);
    expect(c.apiKey).toBe('k');
  });

  it('pins the request caps', () => {
    expect(loadConfig({ MOCK_LLM: '1' }).caps).toEqual({
      msgChars: 500,
      msgs: 16,
      totalChars: 6000,
      maxTokens: 600,
    });
  });

  it('treats empty env values as unset', () => {
    const c = loadConfig({
      OPENROUTER_API_KEY: 'k',
      PORT: '',
      DAILY_CAP: '',
      PROMPTS_DIR: '',
      MOCK_LLM: '',
    });
    expect(c.port).toBe(13331);
    expect(c.dailyCap).toBe(450);
    expect(c.promptsDir).toBe('./prompts');
    expect(c.mockLlm).toBe(false);
  });

  it('treats unparsable numbers as unset', () => {
    const c = loadConfig({ OPENROUTER_API_KEY: 'k', PORT: 'abc', DAILY_CAP: 'lots' });
    expect(c.port).toBe(13331);
    expect(c.dailyCap).toBe(450);
  });

  it('reads overrides', () => {
    const c = loadConfig({
      OPENROUTER_API_KEY: 'k',
      PORT: '8080',
      DAILY_CAP: '25',
      PROMPTS_DIR: '/srv/prompts',
    });
    expect(c.port).toBe(8080);
    expect(c.dailyCap).toBe(25);
    expect(c.promptsDir).toBe('/srv/prompts');
  });

  it('only accepts MOCK_LLM=1 as on', () => {
    expect(loadConfig({ OPENROUTER_API_KEY: 'k', MOCK_LLM: '0' }).mockLlm).toBe(false);
    expect(loadConfig({ OPENROUTER_API_KEY: 'k', MOCK_LLM: 'false' }).mockLlm).toBe(false);
  });
});
