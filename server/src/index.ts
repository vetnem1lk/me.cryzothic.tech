// vai-api — the HTTP service behind the chat on me.cryzothic.tech.
// This file wires the Express app and starts it; `createApp` is exported so
// tests can drive the app without owning a fixed port.
import express from 'express';

export function createApp() {
  const app = express();
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT ?? 13331);
  createApp().listen(port, '127.0.0.1', () =>
    console.log(`[vai-api] listening on 127.0.0.1:${port}`),
  );
}
