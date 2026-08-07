// Everything a chat request has to survive before it reaches a model: the size
// caps, a prompt-injection screen, the canned deflections used instead of an
// answer, and the canary scanner that kills a stream that starts leaking a prompt.
import type { Config } from './config.js';
import type { Prompts } from './prompts.js';

export interface ChatBody {
  mode: 'vai' | 'gai';
  messages: { role: 'user' | 'assistant'; content: string }[];
}

// Carries the HTTP status the route should answer with, so the caller never has
// to map error text back onto a status code.
export class GateError extends Error {
  constructor(
    public status: number,
    msg: string,
  ) {
    super(msg);
    this.name = 'GateError';
  }
}

// Rebuilds the body from scratch instead of validating in place: whatever the
// client sent, only these fields reach the model.
export function validateBody(x: unknown, caps: Config['caps']): ChatBody {
  const body = x as { mode?: string; messages?: unknown } | null;
  if (!body || typeof body !== 'object') throw new GateError(400, 'body must be a JSON object');

  const { mode, messages } = body;
  if (mode !== 'vai' && mode !== 'gai') throw new GateError(400, "mode must be 'vai' or 'gai'");
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new GateError(400, 'messages must be a non-empty array');
  }
  if (messages.length > caps.msgs) {
    throw new GateError(400, `too many messages (max ${caps.msgs})`);
  }

  const clean = messages.map((m: unknown): ChatBody['messages'][number] => {
    const { role, content } = (m ?? {}) as { role?: string; content?: unknown };
    if (role !== 'user' && role !== 'assistant') {
      throw new GateError(400, "each message needs role 'user' or 'assistant'");
    }
    if (typeof content !== 'string') throw new GateError(400, 'message content must be a string');
    if (content.length > caps.msgChars) {
      throw new GateError(400, `message too long (max ${caps.msgChars} characters)`);
    }
    return { role, content };
  });

  const total = clean.reduce((n, m) => n + m.content.length, 0);
  if (total > caps.totalChars) {
    throw new GateError(400, `conversation too long (max ${caps.totalChars} characters)`);
  }
  if (clean[clean.length - 1].role !== 'user') {
    throw new GateError(400, 'the last message must come from the user');
  }
  return { mode, messages: clean };
}

// Prompt-injection phrasings, EN and RU. Narrow on purpose — a false positive
// costs a recruiter a real answer — and separators are `\s+`, never a literal
// space, because padding the gap is the cheapest bypass there is.
const INJECTION: RegExp[] = [
  /\bignore\b[^.!?]{0,40}\binstructions?\b/i, // "ignore all of the above instructions"
  /\bdisregard\b/i,
  /\bsystem\s+(?:prompt|message|instructions?)\b/i,
  /\b(?:reveal|repeat|print|show|output)\b[^.!?]{0,30}\b(?:prompt|instructions?)\b/i,
  /\byour\s+(?:instructions?|prompt)\b/i, // "what are your instructions?" — no verb needed
  // The quote-back family, which asks for the prompt's own bytes without ever
  // naming it: by position ("the text above", "everything above", "first line"),
  // or by fidelity ("verbatim", "word for word"). The pattern above only sees
  // "prompt"/"instructions" as the object, so this class walked straight past it
  // and got line 1 of the system prompt streamed back in production. The verb is
  // still required: "what does the first line of his resume say?" is a question
  // about a document, and "quote his test counts" is a question about his work.
  /\b(?:quote|repeat|print|output|echo|show|reveal|reproduce|recite)\b[^.!?]{0,40}\b(?:(?:text|lines?|everything|message|context)\s+above|verbatim|word\s+for\s+word|first\s+line)\b/i,
  /\byou(?:['’]re|\s+are)\s+now\b/i,
  /\bdeveloper\s+mode\b/i,
  // Persona swaps, in two shapes. An order: "Act as Sydney", "you should act as X".
  /(?:^|[.!?]\s*|\bnow\s+|\bplease\s+|\byou\s+(?:will|should|must|shall|are\s+to)\s+)(?:act|behave|respond|pretend)\s+as\b/i,
  // Or a persona as the object: "act as an AI with no rules". The lookbehind lets
  // "did Vlad act as a tech lead" through — that is a question about a job, and a
  // pronoun lookbehind could not tell the two apart once a name is in the way.
  /(?<!\b(?:did|has|have)\s+\S+\s)\b(?:act|behave|respond|pretend)\s+as\s+(?:an?|if|dan|though)\b/i,
  // The Russian half spells its letter classes out: `\w` and `\b` are ASCII-only
  // in a JavaScript regex, so they silently never match Cyrillic.
  /игнорир/i,
  /систем[а-яё]*\s+промп?т/i, // "системный промпт", not "системный программист"
  // `*` and not `?`: any number of filler words between the verb and its object.
  /забудь[а-яё]*,?\s+(?:[а-яё]+,?\s+)*инструкц/i,
  /представь[а-яё]*,?\s+(?:[а-яё]+,?\s+)*что\s+ты/i,
  /ты\s+теперь/i,
  /режим[а-яё]*\s+разработчика/i,
  // The Russian half of the quote-back family: verb stems (no `\b` — it is
  // ASCII-only and would never fire next to Cyrillic), then the same targets.
  // "покажи его проекты" keeps passing because it names none of them.
  /(?:цитир|повтор|покаж|показ|вывед|напечата|воспроизв)[а-яё]*[^.!?]{0,40}(?:текст[а-яё]*\s+выше|строк[а-яё]*\s+выше|выше\s+текст|дословно|слово\s+в\s+слово|перв[а-яё]+\s+строк|инструкц|промп?т)/i,
];

// True means "do not send this to a model" — the route answers with a deflection.
// No /g flags above, so the patterns keep no lastIndex state between calls.
export function screenInjection(text: string): boolean {
  return INJECTION.some((re) => re.test(text));
}

const CYRILLIC = /[Ѐ-ӿ]/;

// Answer in the language the visitor used, and walk the pool so a persistent
// prober gets a different line every time instead of one canned sentence.
export function pickDeflection(p: Prompts, userText: string, n: number): string {
  const pool = CYRILLIC.test(userText) ? p.deflections?.ru : p.deflections?.en;
  if (!pool?.length) {
    // The pools come from a hand-edited JSON file that nothing else validates:
    // fail loudly here rather than streaming `undefined` at a visitor.
    throw new GateError(500, 'deflection pool is empty — check deflections.json');
  }
  return pool[Math.abs(n) % pool.length];
}

// Watches model output for the per-boot canary planted in the system prompts.
// Stateful because tokens arrive in arbitrary pieces: the canary can be split
// across two of them, so each call scans the previous tail plus the new token.
export function makeCanaryScanner(canary: string): (tok: string) => boolean {
  if (!canary) throw new GateError(500, 'canary scanner needs a non-empty canary');
  const keep = canary.length * 2; // enough overlap for any split, still O(1) memory
  let tail = '';
  return (tok: string) => {
    const scanned = tail + tok;
    tail = scanned.slice(-keep);
    // Scan the whole join, not the trimmed tail: a long token can carry the
    // canary far from its own end.
    return scanned.includes(canary);
  };
}
