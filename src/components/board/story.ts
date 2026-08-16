// The chapter table for the /nda story, and the session-only progress over it:
// which quest guards each chapter, which photo it is, which ones are open, and the
// queue /lore reads freshly opened chapters from. Nothing survives a reload —
// module state, no storage — so every visit starts with all seven covers down.
//
// Board-side only: this file reads the CV flag, and cvFlag.ts must never read
// back, so the entry bundle keeps paying for six lines instead of this store.
import { cvDownloaded } from './cvFlag';
import { type Dir, solves } from './laser';
import { EMPTY_SPRINT, type SprintState, caught, coast, push } from './sprint';

export type ChapterId =
  | 'FILE-01'
  | 'FILE-02'
  | 'FILE-03'
  | 'FILE-04'
  | 'FILE-05'
  | 'FILE-06'
  | 'FILE-07';

export type Quest = 'viewers' | 'guess' | 'cv' | 'declassify' | 'sprint' | 'dialog' | 'laser';

// Which quest guards which chapter — content, not architecture: every quest is the
// joke its own photo already tells. The cats open for whoever has looked in on
// both units in the engine bay; beside a medal stamped "2" any number is the
// right number; the diploma is the thank-you for taking the CV; the conference
// hall is the file VAI can be talked into opening; the mass start is caught by
// pedalling, the badge is talked past, and the rocket is lit by a beam bounced
// into it. Insertion order is the display order.
export const QUESTS: Record<ChapterId, Quest> = {
  'FILE-01': 'cv',
  'FILE-02': 'declassify',
  'FILE-03': 'viewers',
  'FILE-04': 'sprint',
  'FILE-05': 'dialog',
  'FILE-06': 'guess',
  'FILE-07': 'laser',
};

export const CHAPTERS = Object.keys(QUESTS) as ChapterId[];

// `FILE-03` → `ch-03`. The tile and the viewer both build photo URLs, so the cut
// that turns a chapter id into a file slug is made once, here.
export const photoSlug = (id: ChapterId): string => `ch-${id.slice(5)}`;

/**
 * One step along a list of chapters, wrapping at both ends. The viewer walks the
 * open ones with the arrow keys — covered chapters are skipped by never being in
 * the list — and a set of one, or a chapter not in the list at all, goes nowhere.
 */
export function nextChapter(open: ChapterId[], current: ChapterId, step: number): ChapterId {
  const i = open.indexOf(current);
  return i < 0 || open.length < 2 ? current : open[(i + step + open.length) % open.length];
}

// The intrinsic size of each `-1280` derivative, measured on the encoded files.
// Three of them are narrower than the slot name suggests, because the encoder
// refused to upscale a small original — so the width/height attributes and the `w`
// descriptor both come from here and never from the file name. Wrong numbers are
// layout shift.
export const DIMS: Record<ChapterId, [number, number]> = {
  'FILE-01': [799, 600],
  'FILE-02': [855, 1280],
  'FILE-03': [1280, 1703],
  'FILE-04': [1280, 853],
  'FILE-05': [960, 1280],
  'FILE-06': [1280, 2279],
  'FILE-07': [1280, 720],
};

// Derived, never written twice: the table above is the only place the mapping lives.
export const DECLASSIFY_CHAPTER = CHAPTERS.find((c) => QUESTS[c] === 'declassify') as ChapterId;
const CV_CHAPTER = CHAPTERS.find((c) => QUESTS[c] === 'cv') as ChapterId;
const VIEWERS_CHAPTER = CHAPTERS.find((c) => QUESTS[c] === 'viewers') as ChapterId;

/**
 * The badges. Two are the covers themselves — the first one off and the whole set —
 * and the other three are for the visitors who go looking somewhere else entirely.
 */
export type Achievement = 'first-file' | 'all-seven' | 'konami' | 'first-contact' | 'blueprints';

const unlocked = new Set<ChapterId>();
/** Which of the two engine-bay pads have actually been seen lit. */
const viewed = new Set<'m' | 'f'>();
const sprints = new Map<ChapterId, SprintState>();
/** Presence is the whole state: a chapter in here has been answered, once. */
const dialogs = new Map<ChapterId, number>();
const mirrors = new Map<ChapterId, [Dir, Dir]>();
const earned = new Set<Achievement>();
/** Opened but not yet read out: /lore serves these before its own rotation. */
const fresh: ChapterId[] = [];
/** Earned but not yet announced — the same queue idea, one lane over. */
const achFresh: Achievement[] = [];
const subscribers = new Set<() => void>();
let version = 0;

function bump(): void {
  version += 1;
  for (const cb of subscribers) cb();
}

/** The ledger only ever gains: a badge already earned cannot be earned again. */
function earn(id: Achievement): boolean {
  if (earned.has(id)) return false;
  earned.add(id);
  achFresh.push(id);
  return true;
}

// Earned away from a cover, so there is no unlock underneath to carry the notify.
// Inside `unlock` the two are one move for the visitor, and one move is one bump.
function award(id: Achievement): void {
  if (earn(id)) bump();
}

/** The only way a cover comes off — every quest ends here, and only the first time. */
function unlock(id: ChapterId): boolean {
  if (unlocked.has(id)) return false;
  unlocked.add(id);
  fresh.push(id);
  if (unlocked.size === 1) earn('first-file');
  if (unlocked.size === CHAPTERS.length) earn('all-seven');
  bump();
  return true;
}

/** A quest may only touch the chapter it guards: no tile opens by the wrong door. */
const owns = (id: ChapterId, quest: Quest) => QUESTS[id] === quest;

/**
 * The engine bay reporting who actually stood on the pad: boot marks the first
 * character, a completed switch marks the second, and seeing both lifts FILE-03.
 * The same pad twice is still one pad, and nothing on the board shows a
 * half-done pair — so only the unlock itself bumps. The idle prefetch never
 * calls this: downloading F is not seeing F.
 */
export function viewCharacter(id: 'm' | 'f'): boolean {
  viewed.add(id);
  return viewed.size === 2 ? unlock(VIEWERS_CHAPTER) : false;
}

/** Any number is correct, so the number never gets this far — the reward line is the joke. */
export const guess = (id: ChapterId): boolean => (owns(id, 'guess') ? unlock(id) : false);

/**
 * One pedal push, on a clock the caller owns: the speed climbs, coasts back down
 * between pushes, and reaching the target catches the group. The digit on the card
 * moves on every push, so a push that opens nothing still bumps.
 */
export function sprintPush(id: ChapterId, nowMs: number): boolean {
  if (!owns(id, 'sprint') || unlocked.has(id)) return false;
  const s = push(sprints.get(id) ?? EMPTY_SPRINT, nowMs);
  sprints.set(id, s);
  if (!caught(s)) {
    bump();
    return false;
  }
  return unlock(id);
}

/** A pure read — the card asks per frame, and coasting is computed, never stored. */
export const sprintSpeed = (id: ChapterId, nowMs: number): number =>
  coast(sprints.get(id) ?? EMPTY_SPRINT, nowMs).speed;

export type DialogPhase = 'ask' | 'outcome';

/** The guard is asking until something is said; after that he is answering. */
export const dialogState = (id: ChapterId): { phase: DialogPhase; choice: number | null } => {
  const choice = dialogs.get(id);
  return choice === undefined ? { phase: 'ask', choice: null } : { phase: 'outcome', choice };
};

/** Any of the three works — the joke is the outcome line, not the right answer. */
export function dialogChoose(id: ChapterId, choice: 0 | 1 | 2): void {
  if (!owns(id, 'dialog') || dialogs.has(id)) return; // what was said stands
  dialogs.set(id, choice);
  bump();
}

/**
 * How the two mirrors stand — a pure read the panel makes on every render. Untouched
 * they are both `\`, which puts the beam straight into the floor.
 */
export const mirrorDirs = (id: ChapterId): [Dir, Dir] => mirrors.get(id) ?? [0, 0];

/**
 * One mirror turned a quarter — aiming, and nothing more: the figure on the panel moves
 * on every turn, so a turn always bumps. Every quest verb answers "did a cover come
 * off", and this one never takes one off, so the answer is always no.
 */
export function rotateMirror(id: ChapterId, ix: 0 | 1): boolean {
  if (!owns(id, 'laser') || unlocked.has(id)) return false;
  const dirs = [...mirrorDirs(id)] as [Dir, Dir];
  dirs[ix] = ((dirs[ix] + 1) % 4) as Dir;
  mirrors.set(id, dirs);
  bump();
  return false;
}

/**
 * The beam fired, once the mirrors are aimed at the rocket — the panel plays the strike
 * and then asks for this, so an aimed board sits lit until the visitor says fire.
 */
export function laserIgnite(id: ChapterId): boolean {
  if (!owns(id, 'laser') || unlocked.has(id) || !solves(...mirrorDirs(id))) return false;
  return unlock(id);
}

/** The way through, and only once a word has been said. */
export const dialogOpen = (id: ChapterId): boolean =>
  owns(id, 'dialog') && dialogs.has(id) ? unlock(id) : false;

// Reads `file-NN` out of whatever was typed, in any case, and then opens exactly
// one file: a working code for another chapter is refused like a wrong one. A key
// cut for a single lock, not a master key — that is deliberate.
export function declassify(raw: string): ChapterId | null {
  const code = /\bfile-\d\d\b/i.exec(raw)?.[0].toUpperCase();
  return code === DECLASSIFY_CHAPTER && unlock(DECLASSIFY_CHAPTER) ? DECLASSIFY_CHAPTER : null;
}

/**
 * Idempotent by way of `unlock`, so it is safe on every store tick — but call it
 * from an effect, never from a snapshot: it mutates, and getSnapshot must not.
 */
export const syncCvQuest = (): ChapterId | null =>
  cvDownloaded() && unlock(CV_CHAPTER) ? CV_CHAPTER : null;

export const isUnlocked = (id: ChapterId): boolean => unlocked.has(id);

export function takeLoreChapter(): ChapterId | null {
  const id = fresh.shift();
  if (id) bump();
  return id ?? null;
}

/** The cheat code, the first word said to VAI, and the source read: three ways to look. */
export const konamiEntered = (): void => award('konami');
export const firstContact = (): void => award('first-contact');
export const sourceRead = (): void => award('blueprints');

export function takeAchievement(): Achievement | null {
  const id = achFresh.shift();
  if (id) bump();
  return id ?? null;
}

export const earnedCount = (): number => earned.size;

export const hasEarned = (id: Achievement): boolean => earned.has(id);

// useSyncExternalStore contract: subscribe hands back its own unsubscribe, and the
// snapshot is a number, which React can compare without a memo or a deep equal.
export function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

export const getVersion = (): number => version;

/** Test-only: one module instance serves a whole test file, and it remembers. */
export function resetStory(): void {
  unlocked.clear();
  viewed.clear();
  sprints.clear();
  dialogs.clear();
  mirrors.clear();
  earned.clear();
  fresh.length = 0;
  achFresh.length = 0;
  // Subscribers survive — they belong to whoever is mounted, not to the progress —
  // and the version only ever climbs, so nothing is left holding a stale snapshot.
  bump();
}
