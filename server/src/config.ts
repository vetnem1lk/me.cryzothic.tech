// Reads the environment into one Config object — the only place this service
// touches env vars, so every other module takes its settings as an argument.
// Empty values (a bare `PORT=` line in a .env) count as unset, not as zero.

export interface Config {
  apiKey: string;
  port: number;
  promptsDir: string;
  mockLlm: boolean;
  dailyCap: number;
  caps: { msgChars: 500; msgs: 16; totalChars: 6000; maxTokens: 600 };
  models: string[];
  classifierModel: string;
}

// OpenRouter free-tier chain, primary first: sent as models[] so OpenRouter falls
// through to the next one on rate limit or outage. Slugs verified live 2026-08-12.
//
// Exactly three, and no more: OpenRouter rejects the whole request with HTTP 400
// ("'models' array must have 3 items or fewer") — a fourth entry is not a weaker
// fallback, it is total outage. Ordered by time-to-first-token, because a chain is
// tried in order and the primary's latency is the one a visitor feels. The two
// Gemmas do not collapse the diversity the old order paid for (endpoints checked the
// same day): slot 2 is the only slug here served by two providers (Google AI Studio
// and Darkbloom) and slot 3 is served by Darkbloom alone, so Google AI Studio going
// down still leaves two live routes. The pin lives in config.test.ts.
const MODELS = [
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'openai/gpt-oss-20b:free',
];

// Small and cheap: the classifier only answers ON/OFF for the topic gate.
const CLASSIFIER_MODEL = 'google/gemma-4-26b-a4b-it:free';

// `||` and not `??`: an empty or unparsable value (`PORT=`, `DAILY_CAP=lots`)
// must fall back to the default instead of becoming 0 or NaN.
const num = (value: string | undefined, fallback: number) => Number(value) || fallback;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const apiKey = env.OPENROUTER_API_KEY || '';
  const mockLlm = env.MOCK_LLM === '1';
  if (!apiKey && !mockLlm) {
    throw new Error('OPENROUTER_API_KEY is missing (set it, or MOCK_LLM=1 for keyless local dev)');
  }
  return {
    apiKey,
    mockLlm,
    port: num(env.PORT, 13331),
    // Chat turns, not upstream calls: each turn spends two (classifier + answer)
    // against the free account's 1000/day, so 450 is the fuse that fits.
    dailyCap: num(env.DAILY_CAP, 450),
    promptsDir: env.PROMPTS_DIR || './prompts',
    caps: { msgChars: 500, msgs: 16, totalChars: 6000, maxTokens: 600 },
    models: [...MODELS],
    classifierModel: CLASSIFIER_MODEL,
  };
}
