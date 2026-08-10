# me.cryzothic.tech

Interactive, game-shell portfolio of **Vladislav Klimentev** - C++/Qt developer moving
into game development (tools / gameplay track).

> Demo GIF: TBA
>
> Live: https://me.cryzothic.tech

## Why this repo is worth reading

- **The site shows you its own source.** The `/code` view reads the real files at build
  time (`?raw`), so the exhibit cannot drift from what shipped. Since T5 it also carries
  the API's guardrail modules — the code below is on display, which is why every file in
  here opens by saying what it is and why it exists.
- **There is a live agent behind the chat, and its guardrails are open.** See below.
- **The shell stays plain DOM/CSS** so text remains text — accessibility, parsing,
  speed. Motion is GSAP, and everything decorative stops under
  `prefers-reduced-motion`.

## Live agent

The terminal on the left is a real agent, not a scripted demo. It answers in two modes —
**VAI** about Vlad, grounded in a private facts file; **GAI** about anything — and streams
tokens over Server-Sent Events.

Everything that keeps a public agent with a spendable budget honest lives server-side in
[`server/`](server/README.md): an origin allowlist, a per-IP limiter, hard size caps, a
bilingual prompt-injection screen, a global daily fuse, a cheap classifier as the topic
gate, and a per-boot canary that kills any stream which starts quoting the system prompt.
The browser holds no key, no prompt and no rules. The prompts themselves are private, so
this repo ships the guardrails and the tests but cannot run the agent as deployed —
[`server/README.md`](server/README.md) has the full order and the reasoning.

## Stack

- **Front:** Vite 8 · React 19 · TypeScript 6 · Tailwind CSS 4 · wouter · GSAP · oxlint
- **API:** Node 24 · Express 5 · vitest · OpenRouter (free-tier model chain)

## Performance budget

- Initial route JS ≤ 100 KB gzipped; the board and the `/code` exhibit are separate
  on-demand chunks
- Lighthouse ≥ 95 in every category; CLS < 0.1; INP < 200 ms
- Fonts self-hosted with `font-display: swap`, full Cyrillic coverage
- `prefers-reduced-motion` respected throughout

## Repository map

```
me.cryzothic.tech/
├── src/                             # the front end
│   ├── main.tsx                     # browser entry: mounts App, arms preload recovery
│   ├── preloadRecovery.ts           # one reload when a redeploy strands a tab's lazy chunk
│   ├── App.tsx                      # shell: CV strip + cursor eager, board lazy
│   ├── index.css                    # Tailwind + theme tokens + the few hand-written effects
│   ├── content.json                 # EN/RU board dictionary — lazy chunk only, never `?raw`
│   ├── i18n/
│   │   ├── locale.ts                # pure URL<->language math: /ru/* is the whole state
│   │   ├── locale.test.ts           # vitest: the URL<->language pins, incl. /rules staying EN
│   │   ├── I18nContext.ts           # Lang context + dotted-path lookup, EN fallback
│   │   └── strip.ts                 # the only dictionary on the entry path (FastPath copy)
│   ├── *.test.ts                    # vitest: dictionary parity, the /ru emitter, preload recovery
│   └── components/
│       ├── FastPath.tsx             # pinned CV/contact strip — the thirty-second path
│       ├── TargetCursor.tsx         # crosshair cursor, fine pointers only
│       └── board/
│           ├── Board.tsx            # framed two-column layout (terminal | stage)
│           ├── Marquee.tsx          # status bar across the top
│           ├── Stage.tsx            # right column: nav + routed views
│           ├── VaiShell.tsx         # the terminal: log, submit queue, paced typing
│           ├── CommandRow.tsx       # drifting ticker that advertises the commands
│           ├── TextType.tsx         # looping type/delete placeholder label
│           ├── commands.ts          # local commands — work with the API down
│           ├── transport.ts         # the chat contract the UI codes against
│           ├── apiTransport.ts      # its live implementation: POST + SSE reader
│           ├── drain.ts             # pure paced-typing math (no DOM, no timers)
│           ├── wheelMath.ts         # pure wheel→scrollLeft math for the command row
│           ├── story.ts             # /nda chapters: quests, photo slots, unlock state, lore queue
│           ├── cvFlag.ts            # the one boolean the CV links set, session-only
│           ├── *.test.ts            # vitest: commands, drain, story, transport, wheelMath
│           └── views/               # Briefing · Career · Skills · Nda · Loot · Contact · CodeBase · ThreeDView
│               ├── Lightbox.tsx     # native <dialog> photo viewer for the /nda chapters
│               ├── codebaseManifest.ts  # what /code displays, imported `?raw`
│               └── *.test.ts        # vitest: the file /code opens on
├── server/                          # the VAI/GAI API — see server/README.md
│   ├── src/
│   │   ├── index.ts                 # express app: CORS, limiter, routes
│   │   ├── config.ts                # env → typed Config (models, caps, fuse)
│   │   ├── prompts.ts               # loads the private prompts, mints the boot canary
│   │   ├── gates.ts                 # size caps, injection screen, canary scanner
│   │   ├── chat.ts                  # /api/chat: limits → gates → classifier → SSE relay
│   │   └── openrouter.ts            # request shape, SSE parser, model fallback, watchdogs
│   ├── scripts/boot-check.ts        # loads the private prompts as boot does (npm run boot-check)
│   ├── test/                        # vitest suite per module, network never touched
│   ├── evals/                       # guardrail + grounding probes against a live instance
│   ├── prompts/                     # PRIVATE, gitignored (README only)
│   └── .env.example                 # settings, names only
├── scripts/
│   ├── emit-ru-html.mjs             # post-build: writes dist/ru/index.html (RU head, canonical, og-ru)
│   ├── emit-ru-html.d.mts           # its types, so the vitest import stays outside the app program
│   ├── precompress.mjs              # post-build, last: quality-11 .br sidecars for the text assets
│   └── smoke.mjs                    # deploy check: every public URL answers 200 + right media type
├── public/                          # CV PDFs, photos/ for the /nda story, icons, og image, robots.txt, sitemap.xml, llms.txt
├── og/card.html                     # source of the Open Graph image
└── .github/workflows/ci.yml         # lint + test + build, front and server
```

## Develop

```bash
npm ci
npm run dev      # local dev server
npm run lint     # oxlint
npm test         # vitest
npm run build    # type-check + production build
```

The API is a separate workspace with its own scripts — see
[`server/README.md`](server/README.md) for the keyless local path.

## License

MIT
