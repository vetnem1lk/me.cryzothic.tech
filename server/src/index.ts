// vai-api — the HTTP service behind the chat on me.cryzothic.tech.
// This file wires the Express app and starts it. `createApp` takes its config,
// prompts and fetch as arguments so tests can drive the whole stack over real
// HTTP without a key, a prompt file or a network; the zero-argument call is the
// production path and loads all three itself.
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import { dailyFuse, handleChat, ipLimiter, sendJsonError } from './chat.js';
import { loadConfig, type Config } from './config.js';
import { loadPrompts, type Prompts } from './prompts.js';

// The site, the Vite dev server, and the Vite preview server. Nothing else may
// call this API from a browser — a wildcard here would let any page spend the
// daily model budget.
const ORIGINS = new Set([
  'https://me.cryzothic.tech',
  'http://localhost:5173',
  'http://localhost:4173',
]);

// Hand-rolled rather than the `cors` package: three static origins and one
// preflight is less code than a dependency, and every header is visible here.
const cors: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin'); // the response body differs per origin — say so to caches
  if (origin && ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  // A foreign origin still gets an answer, just without the allow header — which
  // is exactly what makes the browser refuse the request.
  if (req.method === 'OPTIONS') return void res.sendStatus(204);
  next();
};

// Express's default handler renders an HTML stack page. Everything this service
// answers is JSON, including a body express.json() refused to parse.
const jsonErrors: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err); // mid-stream: the SSE error event already went out
  sendJsonError(res, err);
};

export interface AppDeps {
  cfg?: Config;
  prompts?: Prompts;
  fetchImpl?: typeof fetch;
}

export function createApp(deps: AppDeps = {}) {
  const cfg = deps.cfg ?? loadConfig();
  const prompts = deps.prompts ?? loadPrompts(cfg.promptsDir);

  const app = express();
  app.disable('x-powered-by');
  app.use(cors);

  // Ahead of every limiter and of the body parser: the deploy script and the
  // uptime probe must never be told to slow down.
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Order matters — each stage is cheaper than the one after it, so a flood is
  // turned away before anything parses its body, let alone calls a model.
  app.use(ipLimiter(), dailyFuse(cfg), express.json({ limit: '8kb' }));
  app.post('/api/chat', (req, res) => handleChat(cfg, prompts, req, res, deps.fetchImpl));

  app.use(jsonErrors);
  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const cfg = loadConfig();
  createApp({ cfg }).listen(cfg.port, '127.0.0.1', () =>
    console.log(`[vai-api] listening on 127.0.0.1:${cfg.port}`),
  );
}
