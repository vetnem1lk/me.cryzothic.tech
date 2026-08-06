export type CommandResult = { text: string; navigateTo?: string };

const JOKES = [
  'Why do C++ gamedevs ship on time? They handle their exceptions before the exceptions handle them.',
  'A designer walks into a bar. The bar was data-driven, so nobody had to recompile.',
  "I'd tell you a UDP joke, but you might not get it — and I wouldn't resend it.",
  '99 little bugs in the code… take one down, patch it around: 127 little bugs in the code.',
];
let jokeIx = 0;

const HELP = [
  '/help — this list',
  '/joke — one gamedev joke',
  'whoami — who is Vlad',
  'ls projects — project list',
  'cat resume — open the loot table (PDFs)',
  'contact — boss fight (direct contact)',
  '/career /skills /nda /loot /contact — jump to a sector',
].join('\n');

const COMMANDS: Record<string, () => CommandResult> = {
  '/help': () => ({ text: HELP }),
  help: () => ({ text: HELP }),
  '/joke': () => ({ text: JOKES[jokeIx++ % JOKES.length] }),
  whoami: () => ({
    text: 'Vladislav Klimentev — C++ developer (Qt tools platform in production; custom C++ glTF engine; TG mini-games). Target: gamedev — tools / gameplay.',
  }),
  'ls projects': () => ({
    text: 'donut-engine/      C++17 glTF renderer, Qt Quick integration\nsed-pro-platform/  Qt Widgets + MySQL, data-driven UI (NDA)\ncyberhockey2077/   neon air-hockey TG mini app\nthis-site/         React 19 + GSAP, open source',
  }),
  'cat resume': () => ({ text: 'Opening the loot table — 4 PDFs, pick your rarity.', navigateTo: '/loot' }),
  contact: () => ({ text: 'Boss fight initiated. Bring an offer.', navigateTo: '/contact' }),
  '/career': () => ({ text: 'Jumping to career progression.', navigateTo: '/career' }),
  '/skills': () => ({ text: 'Jumping to core competencies.', navigateTo: '/skills' }),
  '/nda': () => ({ text: 'Accessing the redacted files…', navigateTo: '/nda' }),
  '/loot': () => ({ text: 'Opening the loot table.', navigateTo: '/loot' }),
  '/contact': () => ({ text: 'Boss fight initiated.', navigateTo: '/contact' }),
};

// ponytail: exact-match registry; fuzzy matching/args arrive with the FAQ corpus (T6)
export function runCommand(raw: string): CommandResult | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  const cmd = COMMANDS[key];
  return cmd ? cmd() : null;
}
