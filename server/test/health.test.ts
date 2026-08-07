// Proves the API boots and answers its health probe — the check CI and the
// deploy script run to know the service is alive. Config and prompts are injected
// because the real prompt files are private and never reach CI.
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { createApp } from '../src/index.js';

describe('health', () => {
  it('responds ok', async () => {
    const cfg = loadConfig({ MOCK_LLM: '1' });
    const prompts = {
      vaiSystem: '',
      gaiSystem: '',
      canary: 'CNRY-health',
      deflections: { vai: { en: [''], ru: [''] }, gai: { en: [''], ru: [''] } },
    };
    const srv = createApp({ cfg, prompts }).listen(0);
    const port = (srv.address() as { port: number }).port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      expect(await res.json()).toEqual({ ok: true });
    } finally {
      srv.close();
    }
  });
});
