// The board's terminal: the visitor's questions, the queue that answers them one
// at a time, and the paced typing that puts each answer on screen character by
// character. The pacing math is drain.ts; the wire is apiTransport.ts.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { navigate } from 'wouter/use-browser-location';
import CommandRow from './CommandRow';
import { runCommand } from './commands';
import TextType from './TextType';
import { apiTransport } from './apiTransport';
import { EMPTY, push, take, type DrainState } from './drain';
import { MODE_HINT, MODE_NAME, history, type AgentMode, type ChatMessage } from './transport';

const GREETING =
  "Player 1 detected. Welcome to the build. I'm VAI — ask about Vlad, or try /help for shell commands.";

const TYPE_SPEED = { min: 45, max: 180 };
const CURSOR_BLINK = 0.5; // seconds per half-blink, matching the input's own cursor

const segClass = (active: boolean, side: 'l' | 'r') =>
  `cursor-target border border-dashed px-2 py-0.5 uppercase ${side === 'l' ? 'rounded-l border-r-0' : 'rounded-r'} ${
    active
      ? 'border-accent/60 text-accent'
      : 'border-neutral-700 text-neutral-500 hover:text-neutral-300'
  }`;

export default function VaiShell({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  // `local`: the greeting is furniture the shell prints, not a turn the model
  // took — replaying it as history would put words in VAI's mouth.
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'agent', text: GREETING, from: 'vai', local: true },
  ]);
  const [mode, setMode] = useState<AgentMode>('vai');
  const modeRef = useRef<AgentMode>('vai');
  // ponytail: promise-chain serialization — replies land in submit order even
  // when a future live transport resolves out of order.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  // A turn reads the log as it stands when the queue reaches it, long after the
  // render that started it — so the ref leads and React follows. Neither an
  // effect nor a functional updater is soon enough: both run at commit or render
  // time, while the next queued turn resumes on a microtask as soon as the last
  // one resolves, and it would read a log still missing the answer that just
  // finished. Every write to the log goes through here, which is what lets the
  // ref be the newest version instead of a copy chasing one.
  const messagesRef = useRef(messages);
  const setMsgs = (fn: (m: ChatMessage[]) => ChatMessage[]) => {
    messagesRef.current = fn(messagesRef.current);
    setMessages(messagesRef.current);
  };
  // Leaving the board must not leave a paint loop or an open socket behind.
  const aliveRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      abortRef.current?.abort();
    };
  }, []);
  // ponytail: read per render like TextType, not subscribed — an OS toggle
  // mid-answer applies to the next turn.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Only one line is ever pending: the queue answers one question at a time.
  const pendingId = messages.find((m) => m.pending)?.id;

  useGSAP(
    () => {
      if (!cursorRef.current) return;
      gsap.to(cursorRef.current, {
        opacity: 0,
        duration: CURSOR_BLINK,
        repeat: -1,
        yoyo: true,
        ease: 'power2.inOut',
      });
    },
    { scope: rootRef, dependencies: [pendingId], revertOnUpdate: true },
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        onMobileClose();
        return;
      }
      if (e.key !== '`' && e.key !== '~') return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen, onMobileClose]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  function switchMode(next: AgentMode) {
    if (next === modeRef.current) return;
    modeRef.current = next;
    setMode(next);
    setMsgs((m) => [...m, { role: 'sys', text: MODE_HINT[next] }]);
  }

  /**
   * One live answer: tokens stream into the drain, a paint loop types them out,
   * and the promise settles when the last character is on screen — which is what
   * holds the next question in the queue until this one has finished.
   */
  const runTurn = (text: string, turnMode: AgentMode, askId: string, replyId: string) =>
    new Promise<void>((resolve) => {
      // Queued behind an unmount: never open a request the board cannot show.
      if (!aliveRef.current) return resolve();
      let st: DrainState = EMPTY;
      let last = performance.now();
      let failed = false;

      const paint = (now: number) => {
        if (!aliveRef.current) return resolve(); // the board went away mid-answer
        const [chunk, next] = take(st, reduced ? Infinity : now - last);
        st = next;
        last = now;
        if (chunk) {
          setMsgs((all) => all.map((m) => (m.id === replyId ? { ...m, text: m.text + chunk } : m)));
        }
        if (st.doneFeeding && st.shown >= st.buf.length) {
          // A turn that produced no text at all leaves no empty line behind, but
          // it does owe the visitor a reason: the error path wrote one already,
          // a clean stream that said nothing has to say so itself.
          if (!st.buf && !failed) {
            setMsgs((m) => [...m, { role: 'sys', text: '[sys] empty response — try again.' }]);
          }
          setMsgs((all) =>
            all
              .filter((m) => m.id !== replyId || m.text)
              .map((m) => (m.id === replyId ? { ...m, pending: false } : m)),
          );
          return resolve();
        }
        requestAnimationFrame(paint);
      };
      requestAnimationFrame(paint);

      const ac = new AbortController();
      abortRef.current = ac;
      apiTransport.send(
        text,
        turnMode,
        // ponytail: `askId` drops this question and only this one. Type a third
        // question while the first answer is still running and it is already in
        // the log, so the model can see a question that comes after the one it
        // is answering — accepted, like drop-oldest: the alternative is threading
        // a turn index through every line.
        history(messagesRef.current, turnMode, askId),
        {
          onToken: (t) => {
            st = push(st, t);
          },
          onDone: () => {
            st = { ...st, doneFeeding: true };
          },
          onError: (msg) => {
            // Ending the feed is what closes the turn: the loop types out
            // whatever arrived, drops the cursor and lets the queue move on.
            // The service's own watchdogs mean a stalled stream lands here too.
            failed = true;
            st = { ...st, doneFeeding: true };
            setMsgs((m) => [...m, { role: 'sys', text: `[sys] ${msg}` }]);
          },
        },
        ac.signal,
      );
    });

  function submit(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const requestMode = modeRef.current;
    // Resolved here, once: /joke and /lore advance a counter, so the queue must
    // not run them a second time. Only the rendering waits for the queue.
    const cmd = runCommand(text);
    const askId = crypto.randomUUID();
    const replyId = crypto.randomUUID();
    // A command and its answer are shell-local — shown, never replayed to the
    // model, whose message and character budget belongs to the conversation.
    setMsgs((m) => [...m, { role: 'user', text, from: requestMode, id: askId, local: !!cmd }]);
    queueRef.current = queueRef.current
      .then(async () => {
        if (cmd) {
          setMsgs((m) => [
            ...m,
            { role: 'agent', text: cmd.text, from: requestMode, local: true },
          ]);
          if (cmd.navigateTo) navigate(cmd.navigateTo);
          return;
        }
        // An empty pending line is the thinking state: the cursor blinks alone
        // until the first token lands.
        setMsgs((m) => [
          ...m,
          { role: 'agent', text: '', from: requestMode, id: replyId, pending: true },
        ]);
        await runTurn(text, requestMode, askId, replyId);
      })
      .catch(() => {
        setMsgs((m) => [...m, { role: 'sys', text: '[sys] transport error — try again.' }]);
      });
  }

  return (
    <aside
      ref={rootRef}
      data-dock
      className={`flex min-h-0 flex-col md:border-r md:border-dashed md:border-neutral-800 ${
        mobileOpen
          ? 'max-md:fixed max-md:inset-x-2 max-md:bottom-2 max-md:z-50 max-md:max-h-[70dvh] max-md:rounded-lg max-md:border max-md:border-accent/50 max-md:bg-neutral-950/95 max-md:backdrop-blur'
          : ''
      }`}
    >
      <header className="flex items-center justify-between border-b border-dashed border-neutral-800 px-3 py-2">
        <span className="font-mono text-xs tracking-widest text-accent uppercase">
          {MODE_NAME[mode]}
        </span>
        <div className="flex items-center gap-3">
          <div role="group" aria-label="agent mode" className="flex font-mono text-[11px]">
            <button
              type="button"
              aria-pressed={mode === 'vai'}
              onClick={() => switchMode('vai')}
              className={segClass(mode === 'vai', 'l')}
            >
              VAI
            </button>
            <button
              type="button"
              aria-pressed={mode === 'gai'}
              onClick={() => switchMode('gai')}
              className={segClass(mode === 'gai', 'r')}
            >
              GAI
            </button>
          </div>
          {mobileOpen && (
            <button
              type="button"
              onClick={onMobileClose}
              className="cursor-target font-mono text-xs text-neutral-400 md:hidden"
            >
              [x] close
            </button>
          )}
        </div>
      </header>
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-sm max-md:max-h-56"
      >
        {messages.map((m, i) =>
          m.role === 'sys' ? (
            <p key={i} className="font-mono text-[11px] text-sep-mint/80">
              {m.text}
            </p>
          ) : (
            <p
              key={i}
              // A line still being typed stays out of the live region: an
              // announcement every frame is unusable. It is read once, whole.
              aria-hidden={m.pending || undefined}
              className={
                m.role === 'agent'
                  ? 'whitespace-pre-line text-neutral-200'
                  : 'text-right text-neutral-400'
              }
            >
              {m.role === 'agent' && (
                <span className="mr-1 font-mono text-accent">{MODE_NAME[m.from ?? 'vai']}:</span>
              )}
              {m.text}
              {m.pending && !reduced && (
                <span ref={cursorRef} className="ml-0.5 inline-block text-accent">
                  _
                </span>
              )}
            </p>
          ),
        )}
      </div>
      <CommandRow onRun={submit} />
      <div aria-hidden className="sep-tri" />
      <form
        className="relative p-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = inputRef.current?.value ?? '';
          if (inputRef.current) inputRef.current.value = '';
          submit(v);
        }}
      >
        <input
          ref={inputRef}
          name="prompt"
          aria-label={`ask ${MODE_NAME[mode]}`}
          autoComplete="off"
          // The service rejects anything longer; better a full field than a
          // round trip that comes back a 400.
          maxLength={500}
          placeholder={`C:\\> ask ${MODE_NAME[mode]} · /help`}
          className="caret-terminal peer w-full bg-transparent px-1 py-1 font-mono text-sm outline-none placeholder:text-transparent focus:placeholder:text-neutral-600"
        />
        <TextType
          key={mode}
          text={`C:\\> ask ${MODE_NAME[mode]} · /help`}
          variableSpeed={TYPE_SPEED}
          className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 font-mono text-sm peer-focus:hidden peer-not-placeholder-shown:hidden"
        />
      </form>
    </aside>
  );
}
