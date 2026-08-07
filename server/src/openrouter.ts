// The only thing in this service that talks to OpenRouter: builds the request,
// turns a Server-Sent-Events response into tokens, and keeps two watchdog timers
// on the stream so a stalled upstream can never hold a browser connection open.
import type { Config } from './config.js';

const CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';
const IDLE_MS = 20_000; // no token for this long — the model has gone quiet
const TOTAL_MS = 60_000; // hard ceiling on one answer, however chatty

export interface ChatMsg {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OrChunk {
  content?: string;
  error?: string;
  done?: boolean;
}

export function chatRequestInit(
  cfg: Config,
  body: {
    messages: ChatMsg[];
    models: string[];
    stream: boolean;
    maxTokens: number;
    temperature: number;
  },
  signal: AbortSignal,
): RequestInit {
  return {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
      // Attribution headers: they put this site on OpenRouter's free-tier
      // dashboard, and unattributed traffic gets throttled harder.
      'HTTP-Referer': 'https://me.cryzothic.tech',
      'X-OpenRouter-Title': 'VAI',
    },
    // The top-level models[] array *is* the fallback: OpenRouter tries them in
    // order and moves on when one is rate-limited or down. Deliberately absent
    // (all retired, re-verified 2026-08-07): `route: 'fallback'`, `usage.include`,
    // `stream_options`.
    body: JSON.stringify({
      models: body.models,
      messages: body.messages,
      stream: body.stream,
      max_tokens: body.maxTokens,
      temperature: body.temperature,
    }),
  };
}

// A visitor only ever sees a sanitized "upstream error", so without this line the
// real reason exists nowhere: OpenRouter explains a rejection in the response body
// ("'models' array must have 3 items or fewer"), and reading that body is also what
// releases the socket. Safe to log — status, our own model chain, OpenRouter's text.
// Never the API key, never the visitor's message, never the system prompt.
async function logUpstreamFailure(res: Response, models: string[]): Promise<void> {
  const detail = await res.text().catch(() => '');
  console.error(`openrouter HTTP ${res.status} [${models.join(', ')}] ${detail}`.trimEnd());
}

// SSE arrives as arbitrary byte chunks, not lines: a frame can be split mid-JSON
// or mid-character, and between frames come keep-alive comments (": OPENROUTER
// PROCESSING"). Anything unparsable is dropped rather than thrown — a single bad
// frame must not kill an answer that is already half-typed on screen.
export async function* parseChatSSE(src: AsyncIterable<Uint8Array>): AsyncGenerator<OrChunk> {
  const dec = new TextDecoder();
  let buf = '';

  const handle = (line: string): OrChunk | null => {
    const l = line.trim();
    if (!l || l.startsWith(':') || !l.startsWith('data:')) return null;
    const payload = l.slice(5).trim();
    if (payload === '[DONE]') return { done: true };
    try {
      const c = JSON.parse(payload);
      // Upstream failures mid-stream arrive as HTTP 200 with an error payload,
      // so the status code alone never tells the whole story.
      if (c.error) return { error: String(c.error.message ?? 'upstream error') };
      const t = c.choices?.[0]?.delta?.content;
      return t ? { content: t } : null;
    } catch {
      return null; // malformed frame — skip, never crash
    }
  };

  for await (const chunk of src) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) !== -1) {
      const out = handle(buf.slice(0, i));
      buf = buf.slice(i + 1);
      if (out?.done) return;
      if (out) yield out;
    }
  }
  const tail = handle(buf); // last line may arrive without its newline
  if (tail && !tail.done) yield tail;
}

// One unstreamed call, used for the topic classifier that gates every chat turn.
// Temperature 0: this call answers a fixed question, it does not write prose.
export async function callBuffered(
  cfg: Config,
  messages: ChatMsg[],
  model: string,
  opts: { maxTokens: number; fetchImpl?: typeof fetch; signal?: AbortSignal },
): Promise<string> {
  const call = opts.fetchImpl ?? fetch;
  // Same composition as streamChat: our watchdog drives `ac`, and the caller's
  // signal (the visitor closed the tab) folds in through AbortSignal.any, which
  // is already aborted when that signal fired before we got here.
  const ac = new AbortController();
  const signal = opts.signal ? AbortSignal.any([opts.signal, ac.signal]) : ac.signal;
  const total = setTimeout(() => ac.abort(), TOTAL_MS);
  try {
    const init = chatRequestInit(
      cfg,
      { messages, models: [model], stream: false, maxTokens: opts.maxTokens, temperature: 0 },
      signal,
    );
    const res = await call(CHAT_URL, init);
    if (!res.ok) {
      // Free-tier 429s are steady state, not an exception — but they still go to
      // the log, and draining the body is what frees the connection either way.
      await logUpstreamFailure(res, [model]);
      throw new Error(`openrouter HTTP ${res.status}`);
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return (data.choices?.[0]?.message?.content ?? '').trim();
  } finally {
    clearTimeout(total);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The streaming call behind /api/chat. Yields plain text tokens; failures are
// thrown, so the route can decide what a half-finished answer should look like.
export async function* streamChat(
  cfg: Config,
  messages: ChatMsg[],
  opts: { temperature: number; fetchImpl?: typeof fetch; signal?: AbortSignal },
): AsyncGenerator<string> {
  // Keyless local dev: enough tokens to exercise the whole UI stream path.
  if (cfg.mockLlm) {
    for (let i = 0; i < 20; i++) {
      await sleep(30);
      yield 'mock ';
    }
    return;
  }

  const call = opts.fetchImpl ?? fetch;
  // Our own controller drives the two watchdogs; AbortSignal.any folds in the
  // caller's (browser hung up) and — unlike an 'abort' listener — is already
  // aborted when the caller's signal was aborted before we even got here.
  const ac = new AbortController();
  const signal = opts.signal ? AbortSignal.any([opts.signal, ac.signal]) : ac.signal;
  const total = setTimeout(() => ac.abort(), TOTAL_MS);
  let idle: NodeJS.Timeout | undefined;
  const armIdle = () => {
    clearTimeout(idle);
    idle = setTimeout(() => ac.abort(), IDLE_MS);
  };
  armIdle(); // covers the connect and the wait for the first token too

  // "Idle" means no BYTES from upstream, not no tokens: OpenRouter sends
  // ": OPENROUTER PROCESSING" keepalives while a slow model thinks, and the
  // parser drops those — watching parsed tokens would kill a stream that is
  // alive but simply has a long time-to-first-token.
  async function* alive(src: AsyncIterable<Uint8Array>) {
    for await (const chunk of src) {
      armIdle();
      yield chunk;
    }
  }

  try {
    const init = chatRequestInit(
      cfg,
      {
        messages,
        models: cfg.models,
        stream: true,
        maxTokens: cfg.caps.maxTokens,
        temperature: opts.temperature,
      },
      signal,
    );
    const res = await call(CHAT_URL, init);
    if (!res.ok) {
      await logUpstreamFailure(res, cfg.models); // same: log it, drain it
      throw new Error(`openrouter HTTP ${res.status}`);
    }
    if (!res.body) throw new Error('openrouter returned no response body');

    for await (const chunk of parseChatSSE(alive(res.body))) {
      if (chunk.error) throw new Error(chunk.error);
      if (chunk.content) yield chunk.content;
    }
  } finally {
    // Also runs when the consumer walks away mid-stream, so no timer outlives
    // the request it was guarding.
    clearTimeout(idle);
    clearTimeout(total);
  }
}
