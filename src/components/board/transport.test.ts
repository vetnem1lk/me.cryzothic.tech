// Pins the browser half of the /api/chat contract: what leaves on the wire, and
// what the client parser does with every frame shape the service can send back —
// tokens, [DONE], a mid-stream error event, and failures before a byte streams.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { apiTransport } from './apiTransport';
import { MODE_HINT, MODE_NAME, type HistoryMsg, type StreamHandlers } from './transport';

const enc = new TextEncoder();

/** A Response whose body streams these chunks — frames may straddle two of them. */
const sse = (...chunks: string[]) =>
  ({
    ok: true,
    body: new ReadableStream<Uint8Array>({
      start(c) {
        for (const chunk of chunks) c.enqueue(enc.encode(chunk));
        c.close();
      },
    }),
  }) as unknown as Response;

const stubFetch = (res: Response | (() => Promise<Response>)) => {
  const impl: typeof fetch = typeof res === 'function' ? res : async () => res;
  const spy = vi.fn(impl);
  vi.stubGlobal('fetch', spy);
  return spy;
};

/** Records every handler call and resolves once the turn reaches a terminal one. */
function handlers() {
  const tokens: string[] = [];
  const errors: string[] = [];
  let dones = 0;
  let settle!: () => void;
  const settled = new Promise<void>((resolve) => (settle = resolve));
  const h: StreamHandlers = {
    onToken: (t) => tokens.push(t),
    onDone: () => {
      dones++;
      settle();
    },
    onError: (m) => {
      errors.push(m);
      settle();
    },
  };
  return {
    h,
    tokens,
    errors,
    settled,
    get dones() {
      return dones;
    },
  };
}

/** One macrotask — enough for every pending microtask in the read loop to run. */
const tick = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => vi.unstubAllGlobals());

describe('apiTransport request', () => {
  test('posts the mode plus prior history with the new user turn appended', async () => {
    const fetchSpy = stubFetch(sse('data: [DONE]\n\n'));
    const s = handlers();
    const history: HistoryMsg[] = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'answer' },
    ];

    apiTransport.send('second', 'gai', history, s.h);
    await s.settled;

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('/api/chat');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      mode: 'gai',
      messages: [...history, { role: 'user', content: 'second' }],
    });
  });
});

describe('apiTransport stream', () => {
  test('delivers tokens in order, then [DONE] closes the turn', async () => {
    stubFetch(sse('data:{"t":"Hel"}\n\n', 'data:{"t":"lo"}\n\n', 'data: [DONE]\n\n'));
    const s = handlers();

    apiTransport.send('hi', 'vai', [], s.h);
    await s.settled;

    expect(s.tokens).toEqual(['Hel', 'lo']);
    expect(s.dones).toBe(1);
    expect(s.errors).toEqual([]);
  });

  test('reassembles frames split across chunk boundaries', async () => {
    stubFetch(sse('data:{"t":"spl', 'it"}\n\ndata:{"t":"!"}', '\n\ndata: [DONE]\n\n'));
    const s = handlers();

    apiTransport.send('hi', 'vai', [], s.h);
    await s.settled;

    expect(s.tokens).toEqual(['split', '!']);
    expect(s.dones).toBe(1);
  });

  test('a malformed frame is skipped, never fatal', async () => {
    stubFetch(sse('data:{"t":"ok"}\n\n', 'data:{not json}\n\n', ': keepalive\n\n', 'data: [DONE]\n\n'));
    const s = handlers();

    apiTransport.send('hi', 'vai', [], s.h);
    await s.settled;

    expect(s.tokens).toEqual(['ok']);
    expect(s.errors).toEqual([]);
    expect(s.dones).toBe(1);
  });

  test('an error event ends the turn and keeps the tokens already delivered', async () => {
    stubFetch(
      sse('data:{"t":"half "}\n\n', 'event: error\ndata:{"message":"response withheld"}\n\n'),
    );
    const s = handlers();

    apiTransport.send('hi', 'vai', [], s.h);
    await s.settled;

    expect(s.tokens).toEqual(['half ']);
    expect(s.errors).toEqual(['response withheld']);
    expect(s.dones).toBe(0);
  });

  test('nothing fires once the turn is terminal', async () => {
    stubFetch(sse('data: [DONE]\n\n', 'data:{"t":"late"}\n\n', 'data: [DONE]\n\n'));
    const s = handlers();

    apiTransport.send('hi', 'vai', [], s.h);
    await s.settled;
    await tick();

    expect(s.dones).toBe(1);
    expect(s.tokens).toEqual([]);
    expect(s.errors).toEqual([]);
  });

  test('a stream that stops without [DONE] fails instead of passing as complete', async () => {
    stubFetch(sse('data:{"t":"cut"}\n\n'));
    const s = handlers();

    apiTransport.send('hi', 'vai', [], s.h);
    await s.settled;

    expect(s.tokens).toEqual(['cut']);
    expect(s.dones).toBe(0);
    expect(s.errors).toHaveLength(1);
  });
});

describe('apiTransport failures', () => {
  test('a pre-stream failure surfaces the service’s own message', async () => {
    stubFetch({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Too many requests — give it a minute.' } }),
    } as unknown as Response);
    const s = handlers();

    apiTransport.send('hi', 'vai', [], s.h);
    await s.settled;

    expect(s.errors).toEqual(['Too many requests — give it a minute.']);
    expect(s.dones).toBe(0);
  });

  test('a non-OK body that is not our JSON shape still names the status', async () => {
    stubFetch({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError('not json');
      },
    } as unknown as Response);
    const s = handlers();

    apiTransport.send('hi', 'vai', [], s.h);
    await s.settled;

    expect(s.errors).toEqual(['request failed (502)']);
  });

  test('a network failure reports exactly one friendly line', async () => {
    stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    const s = handlers();

    apiTransport.send('hi', 'vai', [], s.h);
    await s.settled;
    await tick();

    expect(s.errors).toEqual(['connection failed — try again.']);
    expect(s.dones).toBe(0);
  });

  test('an aborted turn stops clean — no error spam', async () => {
    const ac = new AbortController();
    stubFetch({
      ok: true,
      body: new ReadableStream<Uint8Array>({
        pull(c) {
          // Second pull: the browser has cancelled the body under us, exactly as
          // a real fetch does once its signal fires.
          if (ac.signal.aborted) {
            c.error(new DOMException('aborted', 'AbortError'));
            return;
          }
          c.enqueue(enc.encode('data:{"t":"partial"}\n\n'));
          ac.abort();
        },
      }),
    } as unknown as Response);
    const s = handlers();

    apiTransport.send('hi', 'vai', [], s.h, ac.signal);
    await vi.waitFor(() => expect(s.tokens).toEqual(['partial']));
    await tick();

    expect(s.errors).toEqual([]);
    expect(s.dones).toBe(0);
  });
});

describe('agent modes', () => {
  test('mode hints expand both agent names', () => {
    expect(MODE_HINT.vai).toContain('VladislavAI');
    expect(MODE_HINT.gai).toContain('GlobalAI');
  });

  test('mode names are the two terminal labels', () => {
    expect(MODE_NAME).toEqual({ vai: 'VAI', gai: 'GAI' });
  });
});
