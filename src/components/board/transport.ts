// The contract between the board's terminal and whatever answers it: the two
// agent identities the UI can wear, the streaming handshake every transport
// implements, and the one mapper that turns lines on screen into prior turns on
// the wire. The wire itself lives in apiTransport.ts.
export type AgentMode = 'vai' | 'gai';

/**
 * A clickable follow-up rendered under a message — client-side furniture:
 * `history()` never sends it, so the model and the wire shape stay unchanged.
 */
export type ChatAction = { label: string; to: string };

export interface ChatMessage {
  role: 'user' | 'agent' | 'sys';
  text: string;
  from?: AgentMode;
  /** Stable key for a line that is still being written into. */
  id?: string;
  /** True while tokens are still arriving for this line. */
  pending?: boolean;
  /** A `/command` and its answer: shown in the shell, never sent to the model. */
  local?: boolean;
  /** Links shown under this line — the shell's offer, not the model's words. */
  actions?: ChatAction[];
}

// The two agent names are proper nouns — the same in both languages, so they stay
// here rather than in the dictionary. The mode hints that expand them do not: they
// are prose, and live under `vai.sys.mode*` in content.json.
export const MODE_NAME: Record<AgentMode, string> = { vai: 'VAI', gai: 'GAI' };

/** One earlier turn, in the wire shape the service validates. */
export interface HistoryMsg {
  role: 'user' | 'assistant';
  content: string;
}

// Exactly one of onDone / onError ends a turn, and nothing follows it.
export interface StreamHandlers {
  onToken(t: string): void;
  onDone(): void;
  /**
   * The transport reports *what* failed; the shell decides how to say it. Its own
   * failures are reported as `vai.error.*` dictionary keys (with `vars` for the
   * interpolated one), so they speak the visitor's language. A message the service
   * sent is passed through verbatim and stays English — `useT()` returns an unknown
   * key unchanged, which is exactly that passthrough.
   */
  onError(message: string, vars?: Record<string, string | number>): void;
}

// Budgets copied from the service's own limits (server/src/config.ts `caps`):
// a request carries at most 16 messages of 500 characters, 6000 in total. The
// question being asked takes one slot of each, so history gets what is left.
const MAX_TURNS = 15;
const MAX_CHARS = 500;
const MAX_TOTAL = 5500;

/**
 * The prior turns to send with a new question: same-mode lines only, newest
 * kept, trimmed to what the service accepts. `skip` is the id of the question
 * being asked — that one line is left out, because the transport appends the
 * turn itself. Left out rather than cut at: a question typed while the previous
 * answer was still streaming sits *above* that answer in the log, and dropping
 * everything below it would throw the answer away. An id that is not on screen
 * yet skips nothing, so this is safe to call before React renders the new line.
 */
export function history(msgs: ChatMessage[], mode: AgentMode, skip?: string): HistoryMsg[] {
  const isPrior = (m: ChatMessage) =>
    (m.role === 'user' || m.role === 'agent') && // sys notes are the shell's own voice
    !m.local && // and neither is a /command exchange
    m.from === mode &&
    m.text !== '' && // a turn that failed before its first token has nothing to say
    (skip === undefined || m.id !== skip); // most lines carry no id at all

  const turns: HistoryMsg[] = msgs
    .filter(isPrior)
    .slice(-MAX_TURNS)
    .map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.text.slice(0, MAX_CHARS),
    }));

  let total = turns.reduce((n, m) => n + m.content.length, 0);
  while (total > MAX_TOTAL) total -= turns.shift()!.content.length;
  return turns;
}

export interface ChatTransport {
  /**
   * Fire-and-forget: the answer arrives through `h`, never through a return
   * value. `history` is the PRIOR turns — the transport appends `message` as the
   * final user turn itself, so callers never build that record twice.
   */
  send(
    message: string,
    mode: AgentMode,
    history: HistoryMsg[],
    h: StreamHandlers,
    signal?: AbortSignal,
  ): void;
}
