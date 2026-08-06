import { useEffect, useRef, useState } from 'react';
import { navigate } from 'wouter/use-browser-location';
import CommandRow from './CommandRow';
import { runCommand } from './commands';
import TextType from './TextType';
import {
  MODE_HINT,
  MODE_NAME,
  mockTransport,
  type AgentMode,
  type ChatMessage,
} from './transport';

const GREETING =
  "Player 1 detected. Welcome to the build. I'm VAI — ask about Vlad, or try /help for shell commands.";

const TYPE_SPEED = { min: 45, max: 180 };

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
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'agent', text: GREETING, from: 'vai' },
  ]);
  const [mode, setMode] = useState<AgentMode>('vai');
  const modeRef = useRef<AgentMode>('vai');
  // ponytail: promise-chain serialization — replies land in submit order even
  // when a future live transport resolves out of order.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

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
    setMessages((m) => [...m, { role: 'sys', text: MODE_HINT[next] }]);
  }

  function submit(raw: string) {
    const text = raw.trim();
    if (!text) return;
    const requestMode = modeRef.current;
    setMessages((m) => [...m, { role: 'user', text }]);
    queueRef.current = queueRef.current
      .then(async () => {
        const cmd = runCommand(text);
        if (cmd) {
          setMessages((m) => [...m, { role: 'agent', text: cmd.text, from: requestMode }]);
          if (cmd.navigateTo) navigate(cmd.navigateTo);
          return;
        }
        const reply = await mockTransport.send(text, requestMode);
        setMessages((m) => [...m, { role: 'agent', text: reply, from: requestMode }]);
      })
      .catch(() => {
        setMessages((m) => [...m, { role: 'sys', text: '[sys] transport error — try again.' }]);
      });
  }

  return (
    <aside
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
