export type AgentMode = 'vai' | 'gai';

export interface ChatMessage {
  role: 'user' | 'agent' | 'sys';
  text: string;
  from?: AgentMode;
}

export const MODE_NAME: Record<AgentMode, string> = { vai: 'VAI', gai: 'GAI' };

export const MODE_HINT: Record<AgentMode, string> = {
  vai: "[sys] mode: VAI — VladislavAI, this portfolio's agent. Ask about Vlad.",
  gai: '[sys] mode: GAI — GlobalAI, general mode — not bound to the portfolio.',
};

export interface ChatTransport {
  send(message: string, mode: AgentMode): Promise<string>;
}

// ponytail: honest fallbacks until the FAQ corpus (T6) and the OpenRouter API
// (next stage) — GAI states plainly that no model is wired yet.
export const mockTransport: ChatTransport = {
  send: async (_message, mode) =>
    mode === 'vai'
      ? 'VAI is still waking up — meanwhile: PDFs live under Loot Table, contacts under Boss Fight. Try /help for shell commands.'
      : 'GAI is not wired up yet — no live model behind this input. Flip back to VAI for the portfolio, or try /help.',
};
