export type CommandResult = { text: string; navigateTo?: string };

const JOKES = [
  'Why do C++ gamedevs ship on time? They handle their exceptions before the exceptions handle them.',
  'A designer walks into a bar. The bar was data-driven, so nobody had to recompile.',
  "I'd tell you a UDP joke, but you might not get it — and I wouldn't resend it.",
  '99 little bugs in the code… take one down, patch it around: 127 little bugs in the code.',
];
let jokeIx = 0;

// Facts trace to Resume\context\facts\career-facts.md — keep them defensible.
const LORE = [
  'Lore drop: became team lead 9 months after joining — small team, fast trust loop.',
  'Lore drop: co-authored a physics paper on point-defect evolution in FCC crystals (2023, RINC-indexed).',
  'Lore drop: laureate of the Altai Krai professional-mastery olympiad in IT (2023).',
  'Lore drop: the Sed-Pro platform UI is data-driven — non-programmers reconfigure tools straight from the database.',
];
let loreIx = 0;

const HELP = [
  '/help — this list',
  'whoami — who is Vlad',
  'ls projects — project list',
  '/loadout — equipped stack',
  '/lore — random lore drop',
  '/joke — one gamedev joke',
  '/career /skills /nda /loot /contact — jump to a sector',
].join('\n');

// Canonical commands — the visible surface (command row + /help). Bare unix
// verbs read info, slash commands act; no two entries do the same thing.
const COMMANDS: Record<string, () => CommandResult> = {
  '/help': () => ({ text: HELP }),
  whoami: () => ({
    text: 'Vladislav Klimentev — C++ developer (Qt tools platform in production; custom C++ glTF engine; TG mini-games). Target: gamedev — tools / gameplay.',
  }),
  'ls projects': () => ({
    text: 'donut-engine/      C++17 glTF renderer, Qt Quick integration\nsed-pro-platform/  Qt Widgets + MySQL, data-driven UI (NDA)\ncyberhockey2077/   neon air-hockey TG mini app\nthis-site/         React 19 + GSAP, open source',
  }),
  '/loadout': () => ({
    text: 'main weapon: C++17\noff-hand: Qt (Widgets + Quick)\nskill tree: Unreal Engine — leveling\nside quests: TypeScript · React',
  }),
  '/lore': () => ({ text: LORE[loreIx++ % LORE.length] }),
  '/joke': () => ({ text: JOKES[jokeIx++ % JOKES.length] }),
  '/career': () => ({ text: 'Jumping to career progression.', navigateTo: '/career' }),
  '/skills': () => ({ text: 'Jumping to core competencies.', navigateTo: '/skills' }),
  '/nda': () => ({ text: 'Accessing the redacted files…', navigateTo: '/nda' }),
  '/loot': () => ({ text: 'Opening the loot table.', navigateTo: '/loot' }),
  '/contact': () => ({ text: 'Boss fight initiated. Bring an offer.', navigateTo: '/contact' }),
};

// Hidden aliases — accepted when typed, never listed (no visible duplicates).
const ALIASES: Record<string, () => CommandResult> = {
  help: COMMANDS['/help'],
  'cat resume': () => ({
    text: 'Opening the loot table — 4 PDFs, pick your rarity.',
    navigateTo: '/loot',
  }),
  contact: COMMANDS['/contact'],
};

// Ordered list for the command row; insertion order above is the display order.
export const COMMAND_ROW = Object.keys(COMMANDS);

// ponytail: exact-match registry; fuzzy matching/args arrive with the FAQ corpus (T6)
export function runCommand(raw: string): CommandResult | null {
  const key = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  const cmd = COMMANDS[key] ?? ALIASES[key];
  return cmd ? cmd() : null;
}
