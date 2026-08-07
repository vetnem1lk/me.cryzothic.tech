# vai-api — the service behind the chat

The terminal on [me.cryzothic.tech](https://me.cryzothic.tech) talks to a small Express
service that lives here. It wears two identities: **VAI** answers questions about Vlad
from a private facts file, **GAI** is ordinary open chat. Answers stream token by token
over Server-Sent Events, so text appears while the model is still writing it.

It is a public agent with a spendable budget and a private prompt behind it, so the
interesting part is not the model call — it is everything a request has to survive first.

## What a request goes through

In the order the code runs it (`src/index.ts`, then `src/chat.ts`):

1. **Origin allowlist** — three known origins, no wildcard. A page nobody wrote cannot
   spend the day's model budget from a visitor's browser.
2. **Per-IP rate limit** — 10 requests a minute, keyed on the real client address that
   Cloudflare passes down, and only on the route that costs money.
3. **Body parse** — 16 KB, rejected as JSON, not as an HTML stack page.
4. **Size caps** — 500 characters a message, 16 messages, 6000 characters total, and
   the last turn must be the visitor's. The body is rebuilt from scratch: whatever else
   the client sent does not reach the model.
5. **Injection screen** — EN and RU phrasings of "ignore your instructions", "you are
   now…", persona swaps. A hit on the *visitor's* text is an attack and gets a canned
   deflection instead of a model call. A hit on a replayed *assistant* turn is usually
   the agent quoting itself, so only that turn is dropped from the history.
6. **Daily fuse** — one global counter, spent here and nowhere earlier, so a bad
   afternoon costs a bounded number of free-tier requests rather than the month.
7. **Topic gate (VAI only)** — a separate cheap model answers ON/OFF: is this about
   Vlad. It fails open on purpose; the grounded system prompt still refuses off-topic
   questions, and a classifier outage must not turn the chat into a wall of refusals.
8. **The answer streams** — with a model fallback chain and two watchdog timers, so a
   stalled upstream can never hold a browser connection open.
9. **Canary filter** — output ships slightly behind the stream and is scanned for a
   marker planted in the system prompt at boot. Seeing it means the answer is quoting
   its own instructions, and the stream is killed instead of finished.

Two checks run at startup, both of which would otherwise fail silently in production:
the canary really is present in both system prompts (a lost placeholder would leave the
leak filter watching for something no model has ever seen), and no canned deflection
trips the injection screen (a colliding line would quietly delete a turn of memory from
every conversation that was ever deflected).

## Why it is all server-side

The browser holds no key, no prompt and no rules. Everything above runs where a visitor
cannot edit it — open DevTools on the live site and the most you can do is send a
different JSON body, which is exactly what these gates are written against.

## Why the prompts are private

`prompts/` is gitignored: the system prompts and the facts corpus are personal data and
the guardrail's own definition. **This repo therefore cannot run the agent as deployed** —
clone it and you get the service, the gates and the tests, but not Vlad.

Everything else is here on purpose. The guardrails are the exhibit.

## Prompt deploy

Prompts do not ship with the code: the code goes out through git, the files in
`prompts/` are copied to the server's prompt directory by hand. Edit them locally,
run `npm run boot-check` — it loads them exactly as boot does, so a lost `{{CANARY}}`
or a deflection that collides with the injection screen fails on your machine instead
of in a restart loop — then copy the changed file over and restart the service. Run
the check again after any edit to the injection patterns in `src/gates.ts` too: a
widened pattern can start matching a deflection that booted fine yesterday.

Prompts are read once, at startup. A copied file changes nothing until the restart.

When a prompt change also needs new code to read it, deploy the code first. A running
service only understands the file shapes its own version knows, and a restart into a
shape it cannot parse is a crash loop, not a degraded answer. `deflections.json` is
the nested per-mode file (`{vai:{en,ru}, gai:{en,ru}}`); `npm run boot-check` against
the exact pair you are about to ship is what proves the restart before it happens.

## Run it locally without a key

```bash
npm ci
MOCK_LLM=1 npm run dev   # fake token stream, no OpenRouter, no key
npm run lint && npm run typecheck && npm test
```

`MOCK_LLM=1` replaces the model with a canned token stream, so the gates, the SSE
framing and the client's typing animation all run without a key. The service still
needs the four files named in `prompts/README.md` to boot — a missing prompt is a loud
crash by design, never a quietly ungrounded agent — but placeholder text is enough to
bring it up. The test suite needs nothing: it injects config, prompts and `fetch`, so CI
drives the full stack over real HTTP with no key, no prompt files and no network.

See `.env.example` for the settings; `evals/run.mjs` fires the guardrail probes at a
running instance and exits with the number of failures.
