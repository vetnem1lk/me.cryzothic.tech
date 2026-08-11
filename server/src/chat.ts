// The /api/chat request pipeline: two rate limits, the input gates, the topic
// classifier, and the Server-Sent-Events relay that carries a model answer to the
// browser. Every guardrail this service has either lives here or is called from
// here, in the order a request meets them.
import type { Request, RequestHandler, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { Config } from './config.js';
import type { Prompts } from './prompts.js';
import {
  GateError,
  makeCanaryScanner,
  pickDeflection,
  screenInjection,
  validateBody,
  type ChatBody,
} from './gates.js';
import { callBuffered, streamChat, type ChatMsg } from './openrouter.js';

// A separate, cheap model decides one thing only: is this message about Vlad. Not
// whether we should answer it — that judgement belongs to the grounded system
// prompt one layer down, which knows which personal questions get a refusal and
// which get an answer. Conflating the two cost real questions in prod: "his biggest
// weak point as a candidate" and "his medical diagnoses" were both classified OFF,
// so a recruiter got a joke deflection where the first has an approved answer and
// the second deserves a straight refusal. Unsure means ON: a wrong ON reaches a
// prompt that can still refuse, a wrong OFF reaches nothing at all. Same lesson,
// second round: "How do I open FILE-02 in /nda?" measured OFF in prod — questions
// about navigating the site read as generic coding help unless the site's own
// nouns are spelled out.
export const CLASSIFIER_PROMPT =
  'You decide whether a message is ABOUT Vladislav Klimentev (Vlad) — the subject of this ' +
  'portfolio site — or not. ON = anything about Vlad: his career, skills, projects, ' +
  'education, awards, personality, hobbies, private or personal matters (health, age, ' +
  'salary, contact details, availability), this portfolio site, hiring him, or greetings ' +
  'and small talk addressed to the agent. Questions about using or navigating this site — ' +
  'its pages (/nda, /career, /code), its dossier files (FILE-01 … FILE-07), its games, ' +
  'quests, riddles or slash commands — are ON even when Vlad is not named. Personal ' +
  'questions are still ON: refusing them is not your job, another layer does that. ' +
  'OFF = only messages whose subject is not Vlad at all (general knowledge, world facts, ' +
  'coding help, writing tasks). If unsure, reply ON. Reply with exactly ON or OFF.';

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
    // Both paths go through ipKeyGenerator: it collapses IPv6 to a /56, and a
    // residential IPv6 allocation hands out a fresh address per connection — an
    // address-exact bucket would be no limit at all.
    keyGenerator: (req) => ipKeyGenerator(cfHeader(req) ?? req.ip ?? ''),
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
//
// Not a middleware: as one it ran before the body was parsed, and a cross-origin
// `text/plain` POST is CORS-simple — the browser blocks reading the response,
// never the sending of the request, so any third-party page could have burned the
// whole day on 400s. handleChat calls this once the body is known to be real, and
// what it spends is what an answer actually costs.
export function dailyFuse(cfg: Config): () => void {
  let day = '';
  let spent = 0;
  return () => {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) {
      day = today;
      spent = 0;
    }
    if (++spent > cfg.dailyCap) {
      throw new GateError(
        429,
        'VAI is temporarily unavailable — today’s budget is spent. Try again tomorrow.',
      );
    }
  };
}

// ---------------------------------------------------------------------------
// Errors that happen before any byte is streamed
// ---------------------------------------------------------------------------

// One rule for what a visitor is allowed to read, wherever the failure surfaces.
// Our own 4xx text is useful to them ("message too long (max 500 characters)").
// Anything else — an upstream status code, a prompt filename in a 500 — is for
// the logs, so it is replaced.
export function publicMessage(err: unknown, fallback: string): string {
  const status = (err as { status?: unknown })?.status;
  const ours = typeof status === 'number' && status >= 400 && status < 500;
  return ours ? ((err as Error).message ?? fallback) : fallback;
}

// One shape for every failure the service can still answer with a status code:
// `{error:{message}}`, which is what the frontend parses.
export function sendJsonError(res: Response, err: unknown): void {
  const raw = (err as { status?: unknown })?.status;
  const status = typeof raw === 'number' && raw >= 400 && raw < 600 ? raw : 500;
  res.status(status).json({ error: { message: publicMessage(err, 'internal error') } });
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
    // Two buffers to defeat: the browser cache, and the reverse proxy's buffer,
    // which would otherwise hold the whole answer back until the last byte.
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
async function isOnTopic(
  cfg: Config,
  userText: string,
  signal: AbortSignal,
  fetchImpl?: typeof fetch,
): Promise<boolean> {
  if (cfg.mockLlm) return true; // mock mode means no network, for this call too
  const verdict = await callBuffered(
    cfg,
    [
      { role: 'system', content: CLASSIFIER_PROMPT },
      { role: 'user', content: userText },
    ],
    cfg.classifierModel,
    // Eight tokens is a measured verdict plus headroom — four left it on the edge,
    // and callBuffered deliberately never asks the model to reason, or the budget
    // would go on thinking and come back empty (see chatRequestInit's flag).
    // A visitor who closed the tab is not owed a verdict: the same signal that
    // stops the answering stream stops the call that gates it.
    { maxTokens: 8, fetchImpl, signal },
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

  // Every message is screened; a hit means something different per role.
  //
  // A `user` turn is what the visitor typed, so a hit there is the attack and it
  // gets a deflection. Any user turn counts, not only the newest — parking the
  // payload behind an innocent follow-up is the cheapest bypass there is.
  if (body.messages.some((m) => m.role === 'user' && screenInjection(m.content))) {
    return sse.finish(pickDeflection(prompts, body.mode, userText, seq++));
  }
  // An `assistant` turn is our own prose replayed by the browser. The label is
  // still attacker-controlled, but a hit is far more often VAI quoting itself —
  // "You are now looking at his three biggest projects", "had to act as a tech
  // lead", "режиме разработчика игр" all trip the screen. Dropping the turn keeps
  // the payload away from the model either way, and a false positive then costs
  // one turn of history instead of the whole conversation: deflecting would
  // repeat forever, because the client replays that history on every later turn.
  // validateBody guarantees the last message is a user turn, so this can neither
  // empty the array nor change who speaks last.
  const history = body.messages.filter((m) => m.role === 'user' || !screenInjection(m.content));
  if (body.mode === 'vai' && !(await isOnTopic(cfg, userText, sse.signal, fetchImpl))) {
    return sse.finish(pickDeflection(prompts, body.mode, userText, seq++));
  }

  const system = body.mode === 'vai' ? prompts.vaiSystem : prompts.gaiSystem;
  const messages: ChatMsg[] = [{ role: 'system', content: system }, ...history];
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
  fuse: () => void,
  req: Request,
  res: Response,
  fetchImpl?: typeof fetch,
): Promise<void> {
  let body: ChatBody;
  try {
    body = validateBody(req.body, cfg.caps);
    fuse(); // budget is spent here and nowhere else: after the body proved real
  } catch (err) {
    // Nothing has been written yet, so this can still be a real status code —
    // 400 from the caps, 429 from the fuse.
    sendJsonError(res, err);
    return;
  }

  const sse = openSse(res, prompts.canary);
  try {
    await relay(cfg, prompts, body, sse, fetchImpl);
  } catch (err) {
    // Headers are long gone by now — a failure here can only be an error event,
    // and it is sanitized on the way out like every other visitor-facing failure.
    // Which is exactly why the operator's copy goes to the log first: after the
    // line below, "upstream error" is all that is left of the reason. The message
    // is ours (a status, an upstream error string), never the visitor's text.
    console.error('chat relay failed:', (err as Error).message);
    sse.error(publicMessage(err, 'upstream error'));
  }
}
