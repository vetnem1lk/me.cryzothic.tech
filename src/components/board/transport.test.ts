// Pins the browser half of the /api/chat contract: what leaves on the wire, and
// what the client parser does with every frame shape the service can send back —
// tokens, [DONE], a mid-stream error event, and failures before a byte streams.
import { afterEach, describe, expect, test, vi } from 'vitest';
import { apiTransport } from './apiTransport';
import {
  MODE_HINT,
  MODE_NAME,
  history,
  type ChatMessage,
  type HistoryMsg,
  type StreamHandlers,
} from './transport';

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

afterEach(() => {
  vi.unstubAllGlobals();
  // Spies too: an assertion failing between spying and restoring would leak the
  // stub into every test that runs after it.
  vi.restoreAllMocks();
});

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

  test('a token handler that throws is not mistaken for a broken connection', async () => {
    stubFetch(sse('data:{"t":"one"}\n\n', 'data:{"t":"two"}\n\n', 'data: [DONE]\n\n'));
    const s = handlers();
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const seen: string[] = [];

    apiTransport.send('hi', 'vai', [], {
      ...s.h,
      onToken: (t) => {
        seen.push(t);
        throw new Error('the caller blew up');
      },
    });
    await s.settled;

    expect(seen).toEqual(['one', 'two']); // the stream survives its consumer
    expect(s.errors).toEqual([]);
    expect(s.dones).toBe(1);
    expect(logged).toHaveBeenCalledTimes(2);
  });

  test('an error event split mid-line across chunks still ends the turn', async () => {
    stubFetch(sse('event: er', 'ror\ndata:{"mess', 'age":"response withheld"}\n\n'));
    const s = handlers();

    apiTransport.send('hi', 'vai', [], s.h);
    await s.settled;

    expect(s.errors).toEqual(['response withheld']);
    expect(s.dones).toBe(0);
  });

  test('an error event split from its data line still ends the turn', async () => {
    stubFetch(sse('data:{"t":"half "}\n\nevent: error\n', 'data:{"message":"stopped"}\n\n'));
    const s = handlers();

    apiTransport.send('hi', 'vai', [], s.h);
    await s.settled;

    expect(s.tokens).toEqual(['half ']);
    expect(s.errors).toEqual(['stopped']);
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

describe('history', () => {
  const turns: ChatMessage[] = [
    { role: 'user', text: 'who is vlad', from: 'vai', id: 'q1' },
    { role: 'agent', text: 'a C++ dev', from: 'vai' },
    { role: 'sys', text: '[sys] mode: GAI' },
    { role: 'user', text: 'and games?', from: 'vai', id: 'q2' },
  ];

  test('maps the visible turns to the wire roles', () => {
    expect(history(turns, 'vai')).toEqual([
      { role: 'user', content: 'who is vlad' },
      { role: 'assistant', content: 'a C++ dev' },
      { role: 'user', content: 'and games?' },
    ]);
  });

  test('each mode carries its own conversation', () => {
    const mixed: ChatMessage[] = [
      ...turns,
      { role: 'user', text: 'unrelated', from: 'gai', id: 'q3' },
    ];
    expect(history(mixed, 'gai')).toEqual([{ role: 'user', content: 'unrelated' }]);
  });

  test('leaves out the question being asked, which the transport appends itself', () => {
    expect(history(turns, 'vai', 'q2')).toEqual([
      { role: 'user', content: 'who is vlad' },
      { role: 'assistant', content: 'a C++ dev' },
    ]);
  });

  test('an id that is not on screen yet leaves every turn in place', () => {
    // The queue can run before React has committed the new line: nothing to
    // skip, and every message present is already a prior turn.
    expect(history(turns, 'vai', 'not-rendered-yet')).toHaveLength(3);
  });

  test('an answer that landed below the new question is still a prior turn', () => {
    // Questions echo instantly, answers arrive when the queue reaches them: ask
    // twice in a row and the second question sits above the first answer.
    const raced: ChatMessage[] = [
      { role: 'user', text: 'q1', from: 'vai', id: 'q1' },
      { role: 'user', text: 'q2', from: 'vai', id: 'q2' },
      { role: 'agent', text: 'a1', from: 'vai' },
    ];
    expect(history(raced, 'vai', 'q2')).toEqual([
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
    ]);
  });

  test('a /command and its answer stay in the shell', () => {
    // Shell commands are local theatre: replaying them would spend the model's
    // message and character budget on text it never wrote.
    const withCommand: ChatMessage[] = [
      { role: 'user', text: '/help', from: 'vai', id: 'c1', local: true },
      { role: 'agent', text: '/help — this list', from: 'vai', local: true },
      { role: 'user', text: 'real question', from: 'vai', id: 'q1' },
    ];
    expect(history(withCommand, 'vai')).toEqual([{ role: 'user', content: 'real question' }]);
  });

  test('strips actions from the wire — links are furniture, not conversation', () => {
    const withAction: ChatMessage[] = [
      { role: 'agent', text: 'hi', from: 'vai', actions: [{ label: 'Try the engine', to: '/3d' }] },
      { role: 'user', text: 'q', from: 'vai' },
    ];
    // Exact equality, not a key-shape check: this also fails if a line ever gets
    // dropped from history for carrying links.
    expect(history(withAction, 'vai')).toEqual([
      { role: 'assistant', content: 'hi' },
      { role: 'user', content: 'q' },
    ]);
  });

  test('a turn that produced no text is left out', () => {
    const failed: ChatMessage[] = [
      { role: 'user', text: 'q', from: 'vai' },
      { role: 'agent', text: '', from: 'vai', id: 'dead' },
    ];
    expect(history(failed, 'vai')).toEqual([{ role: 'user', content: 'q' }]);
  });

  test('leaves room for the new question inside the service message cap', () => {
    const many: ChatMessage[] = Array.from({ length: 40 }, (_, i) => ({
      role: i % 2 ? 'agent' : 'user',
      text: `turn ${i}`,
      from: 'vai',
    }));
    const sent = history(many, 'vai');
    expect(sent).toHaveLength(15); // 15 + the appended question = the cap of 16
    expect(sent[14].content).toBe('turn 39'); // and it is the newest that survive
  });

  test('a long turn is trimmed to the per-message cap', () => {
    const long: ChatMessage[] = [{ role: 'agent', text: 'y'.repeat(900), from: 'vai' }];
    expect(history(long, 'vai')[0].content).toHaveLength(500);
  });

  test('the oldest turns go first when the conversation outgrows the budget', () => {
    const heavy: ChatMessage[] = Array.from({ length: 15 }, (_, i) => ({
      role: 'agent',
      text: `${i}`.padEnd(500, '.'),
      from: 'vai',
    }));
    const sent = history(heavy, 'vai');
    const total = sent.reduce((n, m) => n + m.content.length, 0);
    expect(total).toBeLessThanOrEqual(5500); // 6000 total cap, minus the question
    expect(sent[sent.length - 1].content.startsWith('14')).toBe(true);
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
