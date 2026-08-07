// Pins the OpenRouter wire contract: the exact request body (models[] fallback,
// nothing OpenRouter has since retired), an SSE parser that survives every frame
// shape a real stream throws at it, and the two watchdog timers. No test here
// touches the network — fetch is injected and the "stream" is hand-built bytes.
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import {
  callBuffered,
  chatRequestInit,
  parseChatSSE,
  streamChat,
  type ChatMsg,
  type OrChunk,
} from '../src/openrouter.js';

const cfg = loadConfig({ OPENROUTER_API_KEY: 'test-key' });
const msgs: ChatMsg[] = [
  { role: 'system', content: 'You are VAI.' },
  { role: 'user', content: 'hi' },
];

const enc = (s: string) => new TextEncoder().encode(s);
const frame = (content: string) => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;

async function* bytes(...parts: string[]) {
  for (const p of parts) yield enc(p);
}

async function collect(src: AsyncIterable<Uint8Array>): Promise<OrChunk[]> {
  const out: OrChunk[] = [];
  for await (const c of parseChatSSE(src)) out.push(c);
  return out;
}

// Emits its frames one `gap` apart so fake timers can drive the idle/total
// clocks, and rejects the moment the request is aborted — like a real body read.
// One listener for the whole stream: registering one per frame would pile up
// against the EventTarget warning threshold on a long stream.
async function* paced(signal: AbortSignal, gap: number, frames: string[]) {
  let cancelWait = () => {};
  signal.addEventListener('abort', () => cancelWait(), { once: true });
  for (const f of frames) {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, gap);
      cancelWait = () => {
        clearTimeout(t);
        reject(new Error('aborted'));
      };
    });
    yield enc(f);
  }
}

// One frame, then silence until aborted: the stalled-upstream case.
async function* stalls(signal: AbortSignal, first: string) {
  yield enc(first);
  await new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
}

const fakeFetch = (res: unknown) => vi.fn(async (_url: string, _init: RequestInit) => res);
const streamOf = (...parts: string[]) =>
  fakeFetch({ ok: true, status: 200, body: bytes(...parts) });

// vi.fn typing stays on the mock so call args are inspectable; the cast is only
// at the injection point, where a hand-rolled stub stands in for global fetch.
const inject = (fn: unknown) => fn as unknown as typeof fetch;

describe('parseChatSSE', () => {
  it('yields the content deltas in order', async () => {
    expect(await collect(bytes(frame('Hel'), frame('lo')))).toEqual([
      { content: 'Hel' },
      { content: 'lo' },
    ]);
  });

  it('reassembles a data line split across byte chunks', async () => {
    const whole = frame('split');
    const cut = whole.indexOf('cont') + 2;
    expect(await collect(bytes(whole.slice(0, cut), whole.slice(cut)))).toEqual([
      { content: 'split' },
    ]);
  });

  it('reassembles a multi-byte character split across byte chunks', async () => {
    const raw = enc(frame('привет'));
    const head = raw.slice(0, 30);
    const tail = raw.slice(30);
    async function* halves() {
      yield head;
      yield tail;
    }
    expect(await collect(halves())).toEqual([{ content: 'привет' }]);
  });

  it('ignores SSE comment frames', async () => {
    expect(await collect(bytes(': OPENROUTER PROCESSING\n\n', frame('ok')))).toEqual([
      { content: 'ok' },
    ]);
  });

  it('skips a malformed frame and keeps going', async () => {
    expect(await collect(bytes('data: {not json\n\n', frame('ok')))).toEqual([{ content: 'ok' }]);
  });

  it('ignores frames without a content delta', async () => {
    const roleOnly = `data: ${JSON.stringify({ choices: [{ delta: { role: 'assistant' } }] })}\n\n`;
    expect(await collect(bytes(roleOnly, frame('ok')))).toEqual([{ content: 'ok' }]);
  });

  it('stops at [DONE] and drops anything after it', async () => {
    expect(await collect(bytes(frame('a'), 'data: [DONE]\n\n', frame('b')))).toEqual([
      { content: 'a' },
    ]);
  });

  it('surfaces a mid-stream error frame (HTTP 200 + error payload)', async () => {
    const err = `data: ${JSON.stringify({ error: { message: 'rate limited' } })}\n\n`;
    expect(await collect(bytes(frame('a'), err))).toEqual([
      { content: 'a' },
      { error: 'rate limited' },
    ]);
  });

  it('names a message-less error frame', async () => {
    const err = `data: ${JSON.stringify({ error: { code: 429 } })}\n\n`;
    expect(await collect(bytes(err))).toEqual([{ error: 'upstream error' }]);
  });

  it('flushes a trailing line that never got its newline', async () => {
    expect(await collect(bytes(frame('a'), 'data: {"choices":[{"delta":{"content":"b"}}]}'))).toEqual([
      { content: 'a' },
      { content: 'b' },
    ]);
  });

  it('does not yield anything for a trailing [DONE] without a newline', async () => {
    expect(await collect(bytes(frame('a'), 'data: [DONE]'))).toEqual([{ content: 'a' }]);
  });
});

describe('chatRequestInit', () => {
  const init = chatRequestInit(
    cfg,
    { messages: msgs, models: cfg.models, stream: true, maxTokens: 600, temperature: 0.7 },
    new AbortController().signal,
  );
  const headers = init.headers as Record<string, string>;
  const body = JSON.parse(init.body as string) as Record<string, unknown>;

  it('POSTs with the identifying headers', () => {
    expect(init.method).toBe('POST');
    expect(headers).toEqual({
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://me.cryzothic.tech',
      'X-OpenRouter-Title': 'VAI',
    });
  });

  it('sends the fallback chain as top-level models[], primary first', () => {
    expect(body.models).toEqual(cfg.models);
    expect((body.models as string[])[0]).toBe('nvidia/nemotron-3-super-120b-a12b:free');
  });

  it('sends nothing OpenRouter has retired', () => {
    // `route: 'fallback'`, `usage.include` and `stream_options` are all dead as of
    // 2026-08-07 — the body is exactly these five keys and no more.
    expect(Object.keys(body).sort()).toEqual([
      'max_tokens',
      'messages',
      'models',
      'stream',
      'temperature',
    ]);
  });

  it('maps the sampling knobs to the wire names', () => {
    expect(body.stream).toBe(true);
    expect(body.max_tokens).toBe(600);
    expect(body.temperature).toBe(0.7);
    expect(body.messages).toEqual(msgs);
  });

  it('carries the abort signal', () => {
    const ac = new AbortController();
    const withSignal = chatRequestInit(
      cfg,
      { messages: msgs, models: cfg.models, stream: false, maxTokens: 8, temperature: 0 },
      ac.signal,
    );
    expect(withSignal.signal).toBe(ac.signal);
  });
});

describe('callBuffered', () => {
  it('asks one model, unstreamed, and returns the trimmed completion', async () => {
    const f = fakeFetch({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '  ON  ' } }] }),
    });
    const out = await callBuffered(cfg, msgs, cfg.classifierModel, {
      maxTokens: 4,
      fetchImpl: inject(f),
    });

    expect(out).toBe('ON');
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.models).toEqual([cfg.classifierModel]);
    expect(body.stream).toBe(false);
    expect(body.max_tokens).toBe(4);
    expect(body.temperature).toBe(0);
  });

  it('throws with the status on a non-OK response, releasing the socket', async () => {
    const cancel = vi.fn(async () => {});
    const f = fakeFetch({ ok: false, status: 500, body: { cancel }, json: async () => ({}) });
    await expect(
      callBuffered(cfg, msgs, cfg.classifierModel, { maxTokens: 4, fetchImpl: inject(f) }),
    ).rejects.toThrow('openrouter HTTP 500');
    expect(cancel).toHaveBeenCalled();
  });

  it('gives up on a classifier call that never answers', async () => {
    vi.useFakeTimers();
    try {
      const f = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<never>((_resolve, reject) => {
            (init.signal as AbortSignal).addEventListener(
              'abort',
              () => reject(new Error('aborted')),
              { once: true },
            );
          }),
      );
      const call = expect(
        callBuffered(cfg, msgs, cfg.classifierModel, { maxTokens: 4, fetchImpl: inject(f) }),
      ).rejects.toThrow(/abort/i);
      await vi.advanceTimersByTimeAsync(60_000);
      await call;
    } finally {
      vi.useRealTimers();
    }
  });

  it('drops the call when the caller hangs up', async () => {
    // The classifier runs while the visitor's SSE connection is open. Closing the
    // tab mid-classification has to reach upstream, or a departed visitor keeps
    // paying for a verdict nobody will read.
    const ac = new AbortController();
    const f = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<never>((_resolve, reject) => {
          (init.signal as AbortSignal).addEventListener('abort', () => reject(new Error('aborted')), {
            once: true,
          });
        }),
    );
    const call = expect(
      callBuffered(cfg, msgs, cfg.classifierModel, {
        maxTokens: 4,
        fetchImpl: inject(f),
        signal: ac.signal,
      }),
    ).rejects.toThrow(/abort/i);
    ac.abort();
    await call;
  });

  it('returns an empty string when the model answers with nothing', async () => {
    const f = fakeFetch({ ok: true, status: 200, json: async () => ({ choices: [] }) });
    await expect(
      callBuffered(cfg, msgs, cfg.classifierModel, { maxTokens: 4, fetchImpl: inject(f) }),
    ).resolves.toBe('');
  });
});

describe('streamChat', () => {
  it('yields the tokens of a healthy stream', async () => {
    const f = streamOf(': OPENROUTER PROCESSING\n\n', frame('He'), frame('llo'), 'data: [DONE]\n\n');
    const out: string[] = [];
    for await (const t of streamChat(cfg, msgs, { temperature: 0.7, fetchImpl: inject(f) })) {
      out.push(t);
    }
    expect(out).toEqual(['He', 'llo']);
  });

  it('sends the whole fallback chain with stream on and the configured cap', async () => {
    const f = streamOf(frame('a'));
    for await (const _t of streamChat(cfg, msgs, { temperature: 0.4, fetchImpl: inject(f) }));
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.models).toEqual(cfg.models);
    expect(body.stream).toBe(true);
    expect(body.max_tokens).toBe(cfg.caps.maxTokens);
    expect(body.temperature).toBe(0.4);
  });

  it('throws with the status when the stream never opens, releasing the socket', async () => {
    const cancel = vi.fn(async () => {});
    const f = fakeFetch({ ok: false, status: 429, body: { cancel } });
    const run = async () => {
      for await (const _t of streamChat(cfg, msgs, { temperature: 0.7, fetchImpl: inject(f) }));
    };
    await expect(run()).rejects.toThrow('openrouter HTTP 429');
    expect(cancel).toHaveBeenCalled();
  });

  it('throws when a 200 arrives without a body', async () => {
    const f = fakeFetch({ ok: true, status: 200, body: null });
    const run = async () => {
      for await (const _t of streamChat(cfg, msgs, { temperature: 0.7, fetchImpl: inject(f) }));
    };
    await expect(run()).rejects.toThrow(/body/);
  });

  it('throws on a mid-stream error frame, after the partial answer', async () => {
    const err = `data: ${JSON.stringify({ error: { message: 'rate limited' } })}\n\n`;
    const f = streamOf(frame('Hi'), err, frame('never'));
    const out: string[] = [];
    const run = async () => {
      for await (const t of streamChat(cfg, msgs, { temperature: 0.7, fetchImpl: inject(f) })) {
        out.push(t);
      }
    };
    await expect(run()).rejects.toThrow('rate limited');
    expect(out).toEqual(['Hi']);
  });

  it('aborts a stalled stream after the idle timeout', async () => {
    vi.useFakeTimers();
    try {
      const f = vi.fn(async (_url: string, init: RequestInit) => ({
        ok: true,
        status: 200,
        body: stalls(init.signal as AbortSignal, frame('Hi')),
      }));
      const it = streamChat(cfg, msgs, { temperature: 0.7, fetchImpl: inject(f) });
      expect((await it.next()).value).toBe('Hi');

      // Assert before advancing: the rejection must already have a handler when
      // the fake clock fires it, or it surfaces as an unhandled rejection.
      const stalled = expect(it.next()).rejects.toThrow(/abort/i);
      await vi.advanceTimersByTimeAsync(20_000);
      await stalled;
    } finally {
      vi.useRealTimers();
    }
  });

  it('re-arms the idle timer on every token', async () => {
    vi.useFakeTimers();
    try {
      const f = vi.fn(async (_url: string, init: RequestInit) => ({
        ok: true,
        status: 200,
        body: paced(init.signal as AbortSignal, 15_000, [frame('a'), frame('b'), frame('c')]),
      }));
      const out: string[] = [];
      const run = (async () => {
        for await (const t of streamChat(cfg, msgs, { temperature: 0.7, fetchImpl: inject(f) })) {
          out.push(t);
        }
      })();
      await vi.advanceTimersByTimeAsync(46_000);
      await run;
      expect(out).toEqual(['a', 'b', 'c']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('counts keepalive frames as signs of life, not as silence', async () => {
    // The free 120B primary can spend well over 20 s on its first token while
    // sending ": OPENROUTER PROCESSING" the whole time. The parser drops those
    // frames, so the idle watchdog has to watch raw bytes, not parsed tokens.
    vi.useFakeTimers();
    try {
      const keepalive = ': OPENROUTER PROCESSING\n\n';
      const f = vi.fn(async (_url: string, init: RequestInit) => ({
        ok: true,
        status: 200,
        body: paced(init.signal as AbortSignal, 15_000, [keepalive, keepalive, frame('a')]),
      }));
      const out: string[] = [];
      const run = (async () => {
        for await (const t of streamChat(cfg, msgs, { temperature: 0.7, fetchImpl: inject(f) })) {
          out.push(t);
        }
      })();
      await vi.advanceTimersByTimeAsync(46_000);
      await run;
      expect(out).toEqual(['a']); // first token at 45 s, twice the idle budget
    } finally {
      vi.useRealTimers();
    }
  });

  it('cuts off a healthy but endless stream at the total budget', async () => {
    vi.useFakeTimers();
    try {
      const frames = [frame('a'), frame('b'), frame('c'), frame('d'), frame('e')];
      const f = vi.fn(async (_url: string, init: RequestInit) => ({
        ok: true,
        status: 200,
        body: paced(init.signal as AbortSignal, 18_000, frames),
      }));
      const out: string[] = [];
      const run = (async () => {
        for await (const t of streamChat(cfg, msgs, { temperature: 0.7, fetchImpl: inject(f) })) {
          out.push(t);
        }
      })();
      const settled = expect(run).rejects.toThrow(/abort/i);
      await vi.advanceTimersByTimeAsync(61_000);
      await settled;
      expect(out).toEqual(['a', 'b', 'c']);
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops when the caller's signal aborts", async () => {
    const ac = new AbortController();
    const f = vi.fn(async (_url: string, init: RequestInit) => ({
      ok: true,
      status: 200,
      body: stalls(init.signal as AbortSignal, frame('Hi')),
    }));
    const it = streamChat(cfg, msgs, {
      temperature: 0.7,
      fetchImpl: inject(f),
      signal: ac.signal,
    });
    expect((await it.next()).value).toBe('Hi');

    const stalled = it.next();
    ac.abort();
    await expect(stalled).rejects.toThrow(/abort/i);
  });

  it('never opens a stream for a caller who already hung up', async () => {
    // A signal aborted before the call never fires an 'abort' event, so listening
    // for one is not enough — the request has to start out cancelled.
    const ac = new AbortController();
    ac.abort();
    const f = vi.fn(async (_url: string, init: RequestInit) => {
      if ((init.signal as AbortSignal).aborted) throw new Error('aborted');
      return { ok: true, status: 200, body: bytes(frame('nope')) };
    });
    const run = async () => {
      for await (const _t of streamChat(cfg, msgs, {
        temperature: 0.7,
        fetchImpl: inject(f),
        signal: ac.signal,
      }));
    };
    await expect(run()).rejects.toThrow(/abort/i);
  });

  it('serves canned tokens in mock mode, paced, without a key or a network call', async () => {
    vi.useFakeTimers();
    try {
      const mockCfg = loadConfig({ MOCK_LLM: '1' });
      const f = vi.fn();
      const out: string[] = [];
      const run = (async () => {
        for await (const t of streamChat(mockCfg, msgs, {
          temperature: 0.7,
          fetchImpl: inject(f),
        })) {
          out.push(t);
        }
      })();

      await vi.advanceTimersByTimeAsync(29);
      expect(out).toEqual([]); // 30 ms apart, not dumped in one go
      await vi.advanceTimersByTimeAsync(1);
      expect(out).toEqual(['mock ']);

      await vi.advanceTimersByTimeAsync(19 * 30);
      await run;
      expect(out).toEqual(Array(20).fill('mock '));
      expect(f).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
