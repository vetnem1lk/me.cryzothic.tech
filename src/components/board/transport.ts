export interface ChatMessage {
  role: 'user' | 'agent';
  text: string;
}

export interface ChatTransport {
  send(message: string): Promise<string>;
}

// ponytail: honest fallback until the FAQ corpus (T6) and the real API (next stage)
export const mockTransport: ChatTransport = {
  send: async () =>
    'V-Agent is still waking up — meanwhile: PDFs live under Loot Table, contacts under Boss Fight. Try /help for shell commands.',
};
