// The browser end of /api/chat: one POST, then a walk over the Server-Sent-Events
// response handing tokens to the caller as they land. Mirrors the frame writer in
// server/src/chat.ts — that file is the contract, this one is its reader.
import type { AgentMode, ChatTransport, HistoryMsg, StreamHandlers } from './transport';

const ENDPOINT = '/api/chat';
// Whatever actually broke, a visitor gets one line they can act on — as a
// dictionary key, because only the shell knows which language to say it in.
const GENERIC = 'vai.error.connection';

/** A frame payload is JSON; a broken one yields '' rather than throwing. */
const field = (payload: string, key: 'message' | 't'): string => {
  try {
    const v = (JSON.parse(payload) as Record<string, unknown>)[key];
    return typeof v === 'string' ? v : '';
  } catch {
    return ''; // malformed frame — an answer already half on screen survives it
  }
};

async function run(
  message: string,
  mode: AgentMode,
  history: HistoryMsg[],
  h: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  // Handlers are terminal: one onDone or one onError per turn, whatever the
  // stream does afterwards — a second [DONE], a trailing frame, a late failure.
  let closed = false;
  const done = () => {
    if (closed) return;
    closed = true;
    h.onDone();
  };
  const fail = (m: string, vars?: Record<string, string | number>) => {
    if (closed) return;
    closed = true;
    h.onError(m, vars);
  };
  // The wire is fine, its consumer is not: a handler that throws must not reach
  // the visitor as `connection failed`, nor abandon the stream half-read. It
  // goes where a bug belongs — the console — and the answer keeps arriving.
  const emit = (t: string) => {
    try {
      h.onToken(t);
    } catch (e) {
      console.error(e);
    }
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // History is the prior turns; this turn's question is appended here, once.
      body: JSON.stringify({ mode, messages: [...history, { role: 'user', content: message }] }),
      signal,
    });

    if (!res.ok) {
      // Failures before the stream opens are plain JSON, already sanitized by the
      // service — anything else (a proxy's HTML 502) only gets to name its status.
      const data = (await res.json().catch(() => null)) as { error?: { message?: unknown } } | null;
      const m = data?.error?.message;
      if (typeof m === 'string' && m) return fail(m);
      return fail('vai.error.status', { status: res.status });
    }
    if (!res.body) return fail(GENERIC);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let isError = false; // an `event: error` line is waiting for its data line

    const handle = (raw: string): boolean => {
      const line = raw.trim();
      if (line.startsWith('event:')) {
        isError = line.slice(6).trim() === 'error';
        return false;
      }
      if (!line.startsWith('data:')) return false; // blank lines and ': keepalive'
      const payload = line.slice(5).trim();
      if (isError) {
        fail(field(payload, 'message') || GENERIC);
        return true;
      }
      if (payload === '[DONE]') {
        done();
        return true;
      }
      const t = field(payload, 't');
      if (t) emit(t);
      return false;
    };

    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        // A terminal frame ends the turn: stop parsing, and let the socket go
        // instead of leaving an undrained body pinned to the connection.
        if (handle(line)) return void reader.cancel().catch(() => {});
      }
    }
    // The body ended with no [DONE]: the answer was cut off in transit, and the
    // caller must not mistake a truncated reply for a finished one.
    if (!handle(buf + dec.decode())) fail('vai.error.cut');
  } catch {
    // A visitor who moved on gets no error line; there is nothing to report.
    if (!signal?.aborted) fail(GENERIC);
  }
}

export const apiTransport: ChatTransport = {
  send(message, mode, history, h, signal) {
    void run(message, mode, history, h, signal);
  },
};
