// The /api/chat request pipeline: two rate limits, the input gates, the topic
// classifier, and the Server-Sent-Events relay that carries a model answer to the
// browser. Every guardrail this service has either lives here or is called from
// here, in the order a request meets them.
import type { Request, RequestHandler, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { Config } from './config.js';
import type { Prompts } from './prompts.js';
import {
  makeCanaryScanner,
  pickDeflection,
  screenInjection,
  validateBody,
  type ChatBody,
} from './gates.js';
import { callBuffered, streamChat, type ChatMsg } from './openrouter.js';

// A separate, cheap model decides one thing only: is this question about Vlad.
// Kept strict and closed-ended — anything it does not recognise is OFF, and the
// grounded system prompt is still there behind it.
export const CLASSIFIER_PROMPT = `You route questions for VAI, an agent that ONLY discusses Vladislav Klimentev
(Vlad): his career, skills, projects (Donut-Engine, CyberHockey2077, orch_bot,
hypertrade, cryx-vpn, fantasy-durak), education, awards, personality, hobbies,
this portfolio site, or hiring him. Greetings and small talk addressed to the
agent count as ON. Anything else is OFF. Reply with exactly ON or OFF.`;

const VAI_TEMPERATURE = 0.6; // grounded answers: stay close to the facts
const GAI_TEMPERATURE = 0.8; // general chat: allowed to be livelier
const DEFLECTION_MS = 40; // per word, so a canned line still types itself out

// Walks the deflection pool across requests instead of restarting at zero, so a
// visitor who probes three times gets three different lines.
let seq = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

const cfHeader = (req: Request): string | undefined => {
  const raw = req.headers['cf-connecting-ip'];
  return Array.isArray(raw) ? raw[0] : raw;
};

// Per-visitor burst limit. Cloudflare fronts this service, so `req.ip` is a
// Cloudflare edge address that every visitor would share — cf-connecting-ip is
// the real client, and Cloudflare overwrites whatever a client sent.
// ponytail: spoofable if someone reaches the origin directly; the daily fuse
// below is the backstop, and origin access is closed at the firewall.
export function ipLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: 10,
    keyGenerator: (req) => cfHeader(req) ?? ipKeyGenerator(req.ip ?? ''),
    // `app.use('/api/chat', …)` would match by prefix; an exact check keeps the
    // budget on the one route that costs money.
    skip: (req) => req.path !== '/api/chat',
    handler: (_req, res) =>
      sendJsonError(res, { status: 429, message: 'Too many requests — give it a minute.' }),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // We deliberately never read X-Forwarded-For, so `trust proxy` stays off and
    // this library's warning about it does not apply.
    validate: { xForwardedForHeader: false },
  });
}

// The whole site shares one day's worth of model calls, so a bad afternoon costs
// a bounded number of free-tier requests. Keyed by date, which resets it at UTC
// midnight without a timer or a stored counter.
export function dailyFuse(cfg: Config): RequestHandler {
  let day = '';
  let spent = 0;
  return (req, res, next) => {
    if (req.path !== '/api/chat') return next();
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      spent = 0;
    }
    if (++spent > cfg.dailyCap) {
      sendJsonError(res, {
        status: 429,
        message: 'VAI is temporarily unavailable — today’s budget is spent. Try again tomorrow.',
      });
      return;
    }
    next();
  };
}

// ---------------------------------------------------------------------------
// Errors that happen before any byte is streamed
// ---------------------------------------------------------------------------

// One shape for every failure the service can still answer with a status code:
// `{error:{message}}`, which is what the frontend parses. 5xx text is replaced —
// it can carry internals, and a visitor can do nothing with it either way.
export function sendJsonError(res: Response, err: unknown): void {
  const raw = (err as { status?: unknown })?.status;
  const status = typeof raw === 'number' && raw >= 400 && raw < 600 ? raw : 500;
  const message = status >= 500 ? 'internal error' : ((err as Error)?.message ?? 'bad request');
  res.status(status).json({ error: { message } });
}

// ---------------------------------------------------------------------------
// The SSE connection
// ---------------------------------------------------------------------------

interface Sse {
  /** Aborted when the visitor closes the tab, so upstream stops too. */
  signal: AbortSignal;
  /** A model token, held back until the canary window behind it is clear. */
  token(text: string): void;
  /** Types out canned text (a deflection) and closes. */
  finish(text: string): Promise<void>;
  /** Ends the answer with an error event — nothing more will follow. */
  error(message: string): void;
  /** Flushes what is held and closes cleanly. */
  done(): void;
}

const DONE_FRAME = 'data: [DONE]\n\n';

function openSse(res: Response, canary: string): Sse {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    // Two buffers to defeat: the browser cache, and nginx's proxy buffer, which
    // would otherwise hold the whole answer back until the last byte.
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  const ac = new AbortController();
  res.on('close', () => ac.abort());

  // A visitor who closed the tab leaves a destroyed socket behind, and both
  // write() and end() throw on one — so every byte out goes through this check.
  const open = () => !ac.signal.aborted && !res.writableEnded && !res.destroyed;
  const write = (chunk: string) => {
    if (open()) res.write(chunk);
  };
  const end = () => {
    if (open()) res.end();
  };
  const frame = (text: string) => write(`data:${JSON.stringify({ t: text })}\n\n`);

  // Model output ships `canary.length` characters behind the stream. The canary
  // can straddle two tokens, and by the time the scanner sees the second half the
  // first half would already be on screen; held text goes out only once the next
  // token has cleared the scanner.
  let held = '';

  const error = (message: string) => {
    held = ''; // held text belongs to the answer being withheld
    write(`event: error\ndata:${JSON.stringify({ message })}\n\n`);
    end();
  };

  const done = () => {
    // Belt and braces: the scanner already read this text, but it is the last
    // thing to reach the visitor and the check is one comparison.
    if (held.includes(canary)) return error('response withheld');
    if (held) frame(held);
    held = '';
    write(DONE_FRAME);
    end();
  };

  return {
    signal: ac.signal,
    token(text) {
      const buf = held + text;
      const cut = Math.max(0, buf.length - canary.length);
      held = buf.slice(cut);
      if (cut > 0) frame(buf.slice(0, cut));
    },
    async finish(text) {
      for (const word of text.match(/\S+\s*/g) ?? []) {
        if (ac.signal.aborted) return; // visitor left mid-sentence
        frame(word);
        await sleep(DEFLECTION_MS);
      }
      done();
    },
    error,
    done,
  };
}

// ---------------------------------------------------------------------------
// The route
// ---------------------------------------------------------------------------

// Fail-open on purpose: a classifier outage must not turn the chat into a wall of
// deflections, and the grounded system prompt still refuses off-topic questions.
async function isOnTopic(cfg: Config, userText: string, fetchImpl?: typeof fetch): Promise<boolean> {
  if (cfg.mockLlm) return true; // mock mode means no network, for this call too
  const verdict = await callBuffered(
    cfg,
    [
      { role: 'system', content: CLASSIFIER_PROMPT },
      { role: 'user', content: userText },
    ],
    cfg.classifierModel,
    { maxTokens: 4, fetchImpl },
  ).catch(() => 'ON');
  return !verdict.toUpperCase().startsWith('OFF');
}

async function relay(
  cfg: Config,
  prompts: Prompts,
  body: ChatBody,
  sse: Sse,
  fetchImpl?: typeof fetch,
): Promise<void> {
  const userText = body.messages[body.messages.length - 1].content;

  // Screen every user turn, not only the newest: parking the payload in an
  // earlier message and following it with something innocent is the cheapest way
  // past a last-message-only screen.
  if (body.messages.some((m) => m.role === 'user' && screenInjection(m.content))) {
    return sse.finish(pickDeflection(prompts, userText, seq++));
  }
  if (body.mode === 'vai' && !(await isOnTopic(cfg, userText, fetchImpl))) {
    return sse.finish(pickDeflection(prompts, userText, seq++));
  }

  const system = body.mode === 'vai' ? prompts.vaiSystem : prompts.gaiSystem;
  const messages: ChatMsg[] = [{ role: 'system', content: system }, ...body.messages];
  const hit = makeCanaryScanner(prompts.canary);
  for await (const tok of streamChat(cfg, messages, {
    temperature: body.mode === 'vai' ? VAI_TEMPERATURE : GAI_TEMPERATURE,
    fetchImpl,
    signal: sse.signal,
  })) {
    // Leakage kill-switch: the canary only ever appears in the system prompt, so
    // seeing it in output means the answer is quoting instructions.
    if (hit(tok)) return sse.error('response withheld');
    sse.token(tok);
  }
  sse.done();
}

export async function handleChat(
  cfg: Config,
  prompts: Prompts,
  req: Request,
  res: Response,
  fetchImpl?: typeof fetch,
): Promise<void> {
  let body: ChatBody;
  try {
    body = validateBody(req.body, cfg.caps);
  } catch (err) {
    // Nothing has been written yet, so this can still be a real status code.
    sendJsonError(res, err);
    return;
  }

  const sse = openSse(res, prompts.canary);
  try {
    await relay(cfg, prompts, body, sse, fetchImpl);
  } catch (err) {
    // Headers are long gone by now — a failure here can only be an error event.
    sse.error(err instanceof Error ? err.message : 'upstream error');
  }
}
