# me.cryzothic.tech

Interactive, game-shell portfolio of **Vladislav Klimentev** - C++/Qt developer moving
into game development (tools / gameplay track).

> Demo GIF: TBA
>
> Live: https://me.cryzothic.tech (first deploy pending)

## Why this repo is worth reading

- **The whole UI is data-driven.** Every view renders from a single bilingual
  `content.json` (en/ru). This mirrors the architecture of the SQL-first production
  platform I build at my day job, where the database defines forms, widgets and button
  logic and the C++/Qt client renders them. Here JSON defines the views and React
  renders them - same archetype, different host.
- **The game layer is real code, not a template.** The interactive scene ships as a
  lazy-loaded Phaser 4 chunk; the shell stays plain DOM/CSS so text remains text
  (accessibility, parsing, speed).

## Stack

Vite 8 · React 19 · TypeScript 6 · Tailwind CSS 4 · wouter · Phaser 4 (game layer,
lazy chunk) · oxlint

## Performance budget

- Initial route JS ≤ 100 KB gzipped; Phaser loads as a separate on-demand chunk
- Lighthouse ≥ 95 in every category; CLS < 0.1; INP < 200 ms
- Fonts self-hosted with `font-display: swap`, full Cyrillic coverage
- `prefers-reduced-motion` respected throughout

## Develop

```bash
npm ci
npm run dev      # local dev server
npm run lint     # oxlint
npm run build    # type-check + production build
```

## License

MIT
