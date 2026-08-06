import { useEffect, useRef, useState } from 'react';
import { navigate } from 'wouter/use-browser-location';
import { runCommand } from './commands';
import { mockTransport, type ChatMessage } from './transport';

const GREETING =
  "Player 1 detected. Welcome to the build. I'm V-Agent — ask about Vlad, or try /help for shell commands.";

const CHIPS = ['whoami', '/joke', 'cat resume', 'contact'];

export default function VaiShell({
  mobileOpen,
  onMobileClose,
}: {
  mobileOpen: boolean;
  onMobileClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'agent', text: GREETING }]);
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

  async function submit(raw: string) {
    const text = raw.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    const cmd = runCommand(text);
    if (cmd) {
      setMessages((m) => [...m, { role: 'agent', text: cmd.text }]);
      if (cmd.navigateTo) navigate(cmd.navigateTo);
      return;
    }
    const reply = await mockTransport.send(text);
    setMessages((m) => [...m, { role: 'agent', text: reply }]);
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
        <span className="font-mono text-xs tracking-widest text-accent uppercase">V-Agent</span>
        {mobileOpen && (
          <button
            type="button"
            onClick={onMobileClose}
            className="cursor-target font-mono text-xs text-neutral-400 md:hidden"
          >
            [x] close
          </button>
        )}
      </header>
      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        className="scroll-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-sm max-md:max-h-56"
      >
        {messages.map((m, i) => (
          <p
            key={i}
            className={
              m.role === 'agent'
                ? 'whitespace-pre-line text-neutral-200'
                : 'text-right text-neutral-400'
            }
          >
            {m.role === 'agent' && <span className="mr-1 font-mono text-accent">V:</span>}
            {m.text}
          </p>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 px-3 pb-2">
        {CHIPS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => void submit(c)}
            className="cursor-target rounded border border-dashed border-neutral-700 px-2 py-0.5 font-mono text-[11px] text-neutral-300 hover:border-accent/60"
          >
            {c}
          </button>
        ))}
      </div>
      <div aria-hidden className="sep-tri" />
      <form
        className="p-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = inputRef.current?.value ?? '';
          if (inputRef.current) inputRef.current.value = '';
          void submit(v);
        }}
      >
        <input
          ref={inputRef}
          name="prompt"
          autoComplete="off"
          placeholder="C:\> ask V-Agent · /help"
          className="w-full bg-transparent px-1 py-1 font-mono text-sm outline-none placeholder:text-neutral-600"
        />
      </form>
    </aside>
  );
}
