// The contract between the board's terminal and whatever answers it: the two
// agent identities the UI can wear, and the streaming handshake every transport
// implements. Types only — the wire lives in apiTransport.ts.
export type AgentMode = 'vai' | 'gai';

export interface ChatMessage {
  role: 'user' | 'agent' | 'sys';
  text: string;
  from?: AgentMode;
  /** Stable key for a line that is still being written into. */
  id?: string;
  /** True while tokens are still arriving for this line. */
  pending?: boolean;
}

export const MODE_NAME: Record<AgentMode, string> = { vai: 'VAI', gai: 'GAI' };

export const MODE_HINT: Record<AgentMode, string> = {
  vai: "[sys] mode: VAI — VladislavAI, this portfolio's agent. Ask about Vlad.",
  gai: '[sys] mode: GAI — GlobalAI, general mode — not bound to the portfolio.',
};

/** One earlier turn, in the wire shape the service validates. */
export interface HistoryMsg {
  role: 'user' | 'assistant';
  content: string;
}

// Exactly one of onDone / onError ends a turn, and nothing follows it.
export interface StreamHandlers {
  onToken(t: string): void;
  onDone(): void;
  onError(message: string): void;
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
