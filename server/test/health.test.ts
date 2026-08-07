// Proves the API boots and answers its health probe — the check CI and the
// deploy script run to know the service is alive.
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/index.js';

describe('health', () => {
  it('responds ok', async () => {
    const srv = createApp().listen(0);
    const port = (srv.address() as { port: number }).port;
    const res = await fetch(`http://127.0.0.1:${port}/api/health`);
    expect(await res.json()).toEqual({ ok: true });
    srv.close();
  });
});
