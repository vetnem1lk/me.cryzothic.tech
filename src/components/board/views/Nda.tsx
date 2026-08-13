// The /nda view: a case file with seven covers on it. Every chapter is a photo, and
// every photo is guarded by a small joke of a quest — a knock, a number nobody
// checks, a CV that opens its own file, one word with VAI. Progress is session-long
// on purpose: reload and all seven covers are back down.
//
// Every cover is a riddle rather than a caption: one large element that changes as the
// visitor works on it, one hint line under it that never names the mechanic, and —
// wherever the mechanic is nothing but a click — the whole cover is the button, so
// there is no small control to find and the row itself is the thing you press.
//
// The two project dossiers this sector started out as are not gone; they are folded
// into the archive at the foot of the page, which is the only place on this site
// where what is withheld is printed next to what is not.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'wouter';
import content from '../../../content.json';
import { useLang, useT } from '../../../i18n/I18nContext';
import Corners from '../Corners';
// Aliased: `step` is already a frame of the sprint's clock further down this file, and
// one name for two things is what someone has to decode later.
import { step as dial } from '../codelock';
import { MIRRORS, SOURCE, TARGET, VIEW, blockedEdge, trace } from '../laser';
import {
  CHAPTERS,
  DIMS,
  QUESTS,
  dialogChoose,
  dialogOpen,
  dialogState,
  getVersion,
  guess,
  isUnlocked,
  knock,
  knockCount,
  laserIgnite,
  mirrorDirs,
  photoSlug,
  rotateMirror,
  sprintPush,
  sprintSpeed,
  subscribe,
  syncCvQuest,
  type ChapterId,
} from '../story';
import Lightbox from './Lightbox';

// Slots: a 420px pane once the row form is on at xl. Below it the photo spans the stage
// column, which is the viewport less everything around it — 24 gutter, 2 frame, 320 chat,
// 7 scrollbar, 32 card padding, 2 card border. Exact while the chat column sits on its
// 320 minimum, generous above that where it grows to 30%, which is the safe way to be off.
const SIZES =
  '(min-width: 1280px) 420px, (min-width: 768px) calc(100vw - 387px), calc(100vw - 58px)';

// Not Briefing's CHIP, which only ever looked like it: this one is the control a quest
// hands the visitor when a bare cover-press will not do — a submit, a line of dialogue.
// No target here: a target nested inside a cover that is itself one shadows the frame
// the whole card would otherwise get. The lock's wheels and lever add it back, their
// cover being no target; the dialogue's choices go without, its cover waiting as one.
const QUEST_BTN =
  'rounded-md border border-dashed border-accent/50 px-2 py-1 font-mono text-sm text-neutral-200 hover:border-accent';

// Every stamp line on the page, at the one size they all share. Spelled out instead of
// composed wherever a heading wants a different size: two font-size classes in one list
// settle by the order Tailwind emits them, not the order they were written: `CAPS
// text-base` resolves the same way every build, just not necessarily to `text-base`.
// The headings below spell all five of their classes out.
const CAPS = 'font-mono text-xs tracking-widest uppercase';

// One cover, one row: the stamp in the top-left corner, the riddle in the middle, the
// hint under it. Every cover wears exactly this, button or not, which is what keeps a
// pressable row from advertising itself as one — finding that out is the game. The
// crosshair is not part of it: it goes on the covers the visitor presses, and on the
// dialogue while it waits for its answer. `relative` is here for the stamp alone, which
// hangs off this box's corner rather than standing in the column with the riddle.
//
// The height is a floor rather than a fixed box. Wide, the floor is the height of the
// photo pane the cover hides, so lifting one shifts nothing; stacked, the photo alone
// can run past the floor several times over, so lifting a cover grows the row. Either
// way a cover that outgrows the floor pushes its own row down instead of scrolling
// inside a square it can no longer hold. `-safe` centring stays for that case: plain
// `center` overflows in both directions and puts the top of a long card out of reach.
const COVER = `relative flex min-h-[360px] w-full flex-col items-center gap-1.5 bg-gradient-to-b from-neutral-950/80 to-neutral-900/40 p-3 text-center xl:min-h-[420px]`;

// The riddle element: a digit or a symbol, never a word — reading it is the puzzle. It
// grows with the row, because on a row this size a small one reads as a caption.
const BIG = 'block font-mono text-6xl leading-none text-neutral-100 sm:text-7xl lg:text-8xl';
const HINT = 'block text-base leading-snug text-neutral-400';
// The rocket is the one cover carrying two lines of prose under its riddle — the hint
// and the beam's own report — so both of them shrink to buy the scene its room back.
// Colourless: the two lines rank differently, and one class list must not try to win
// a specificity argument with the other.
const FINE = 'block text-xs leading-snug';
// Prose on a cover, which only the dialogue has: the guard's line and his answer. Capped
// at the same measure as the prose everywhere else on the page — the row is wide enough
// to run these two sentences out to a single unreadable line, and a text column is the
// one thing the extra width should not be spent on.
const SAID = 'block max-w-2xl text-sm leading-snug text-neutral-300';

type Labels = (typeof content)['en']['sector']['nda']['labels'];

// The two lines every cover carries, whatever quest is under them. The file number is
// id'd so a cover that is a button can say it first, before the riddle's own line.
//
// One block in the true corner of the cover, while the riddle keeps the middle to
// itself: markings belong on the corner of a cover rather than over the thing the cover
// is asking. It opts out of the centred flow altogether — `top-3 left-3` pins it to the
// cover's own padding corner whatever the flow below it does (the rocket pads its flow
// clear of this corner), and leaving the flow is what stops a two-line header from
// pushing the riddle off centre.
// A span and not a div, because three of the covers are buttons and a button may hold
// neither a division nor anything else that is not phrasing — an absolutely positioned
// box is blockified anyway, so the two readings stack exactly as they did loose.
const stamp = (code: string, classified: string, id: ChapterId) => (
  <span className="absolute top-3 left-3 text-left">
    <span id={`${id}-code`} className={`${CAPS} block text-accent`}>
      {code}
    </span>
    <span className={`${CAPS} block text-neutral-400`}>{classified}</span>
  </span>
);

// Language-neutral on purpose: the mirrors need names that never change with rotation
// and never need translating. The riddle line is what says what a mirror is for.
const MIRROR_NAMES = ['A', 'B'];
// Source → both mirrors → the rocket or the wall: the vertices of the longest path the
// tracer can hand back. The beam is drawn with one <line> per vertex, which is always one
// or two more than the path needs — the spares collapse onto the last point and draw
// nothing, and no setting ever mounts or unmounts a line.
const BEAM_SEGMENTS = MIRRORS.length + 2;

// How long the rocket stays lit before the file opens. The beam has to be seen to arrive
// and the status line has to be read out while the cover is still on screen, so the strike
// and the unlock are two moments rather than one. Timing, not motion: it runs whatever the
// visitor's motion setting says.
const HIT_FRAME_MS = 900;

/**
 * The beam and the mirrors, straight off the geometry module. GSAP owns every
 * coordinate here and none of them appear in the JSX, so a React re-render can never
 * snap a line back mid-tween. `animate: false` is the same end state without the
 * travel — which is what mount and reduced motion both want, and why neither of them
 * can take the early return that would leave the beam undrawn.
 */
function paint(svg: SVGSVGElement | null, id: ChapterId, animate: boolean): void {
  if (!svg) return;
  const dirs = mirrorDirs(id);
  const { path } = trace(...dirs);
  svg.querySelectorAll<SVGLineElement>('[data-beam]').forEach((line, i) => {
    // A path is three or four vertices long. Segments past its end collapse onto the last
    // one, and a zero-length line with butt caps draws nothing — so the same four
    // elements serve every setting and nothing mounts as the beam changes shape.
    const a = path[Math.min(i, path.length - 1)];
    const b = path[Math.min(i + 1, path.length - 1)];
    const attr = { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    if (animate) gsap.to(line, { attr, duration: 0.25, ease: 'power1.out', overwrite: 'auto' });
    else gsap.set(line, { attr });
  });
  svg.querySelectorAll<SVGLineElement>('[data-mirror]').forEach((m, i) => {
    // Absolute angle, never `+=90`: two fast clicks must not queue two quarter turns
    // and leave the glass pointing somewhere the store never agreed to.
    const to = { rotation: dirs[i] * 90, svgOrigin: `${MIRRORS[i].x} ${MIRRORS[i].y}` };
    if (animate) gsap.to(m, { ...to, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
    else gsap.set(m, to);
  });
}

/**
 * The rocket cover: a beam that is visibly firing and visibly missing from the first
 * paint, and two mirrors to turn. The SVG is scenery — `aria-hidden` — and the two
 * controls over it are ordinary buttons, which is all two of them need to be.
 */
function Laser({
  id,
  code,
  labels,
  onIgnite,
}: {
  id: ChapterId;
  code: string;
  labels: Labels;
  onIgnite: (id: ChapterId) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const beam = trace(...mirrorDirs(id));
  const edge = blockedEdge(beam);

  // Instant, and before the browser paints: a panel whose beam arrives a beat late
  // reads as decoration rather than as something that is already going wrong.
  const { contextSafe } = useGSAP(() => paint(svg.current, id, false), { scope: svg });

  // The strike, then the file. Turning the mirrors never opens anything on its own — this
  // is what opens it, one hit-frame after the beam lands, so the panel has a moment where
  // the rocket is lit and the line under it can still be read. Leaving the view drops the
  // frame with the cover. Every name it depends on is listed, which is why the callback
  // has to keep its identity between renders: this card re-renders on somebody else's
  // animation frame, and a new one each time would reset the timer before it ever ran.
  useEffect(() => {
    if (!beam.hit || isUnlocked(id)) return;
    const frame = setTimeout(() => onIgnite(id), HIT_FRAME_MS);
    return () => clearTimeout(frame);
  }, [beam.hit, id, onIgnite]);

  // Wrapped, because a tween created inside a handler escapes the hook's context and
  // would outlive the cover it belongs to.
  const turn = contextSafe((ix: 0 | 1) => {
    if (beam.hit) return; // the beam is on the rocket: the board is settled, the frame runs
    rotateMirror(id, ix);
    paint(svg.current, id, matchMedia('(prefers-reduced-motion: no-preference)').matches);
  });

  // Centred like the other six, and the only one that has to buy room to do it: the scene
  // is 208px of square before either line under it is counted, so a flow centred in the
  // whole cover would start level with the stamp's last line. The extra top padding is
  // measured against the stamp rather than chosen — 48px clears the 45 the block occupies
  // (12 down, then two 16.5px lines) — and it is padding rather than a gap under the stamp
  // because the stamp is positioned against the padding box and so does not move with it.
  // `-safe` centring falls back to the top edge when a translation runs long, so the flow
  // starts at 48 at worst and can never climb into the corner, whatever the wrapping does.
  return (
    <div className={`${COVER} justify-center-safe pt-12`}>
      {stamp(code, labels.classified, id)}
      {/* Square by a height it is given, never by the width it is offered: the row is far
          wider than it is tall, and a square that took the width would stand a whole
          screen high and drag its row with it. These two heights are what the cover's own
          floor holds with the two lines below them — the stamp is off in the corner and
          costs the scene nothing — so the rocket's row measures what the six other rows
          measure. */}
      <div className="relative aspect-square h-52 xl:h-72">
        <svg
          ref={svg}
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
        >
          <circle cx={SOURCE.x} cy={SOURCE.y} r="3" fill="var(--color-accent)" />
          <path
            d={`M${TARGET.x} ${TARGET.y - 7}l4 11h-8z`}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="1.5"
          />
          {/* Collapsed onto the emitter, and spelled out rather than left off: an
              absent x1 parses as "" and the SVG parser logs a bad-attribute error for
              every one of them at every mount. These four values are constant across
              renders, so React writes them once and never contests the coordinates
              again — paint() takes ownership before the first frame is shown. */}
          {Array.from({ length: BEAM_SEGMENTS }, (_, i) => (
            <line
              key={`beam-${i}`}
              data-beam
              x1={SOURCE.x}
              y1={SOURCE.y}
              x2={SOURCE.x}
              y2={SOURCE.y}
              stroke="var(--color-accent)"
              strokeWidth="1.5"
            />
          ))}
          {MIRRORS.map((m) => (
            <line
              key={`${m.x}-${m.y}`}
              data-mirror
              x1={m.x - 8}
              y1={m.y - 8}
              x2={m.x + 8}
              y2={m.y + 8}
              stroke="#d4d4d4"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          ))}
        </svg>
        {MIRRORS.map((m, i) => (
          <button
            key={`${m.x}-${m.y}`}
            type="button"
            onClick={() => turn(i as 0 | 1)}
            aria-label={MIRROR_NAMES[i]}
            aria-describedby={`${id}-hint`}
            // Inert for the length of the hit-frame, and by aria rather than by
            // `disabled`: a disabled control drops focus to <body> mid-frame, and the
            // line the frame exists to have read out is announced with the keyboard
            // still standing on the mirror it just turned.
            aria-disabled={beam.hit}
            // A fifth of the scene, and that is a ceiling rather than a taste: the far
            // mirror stands a tenth of the way down, so a target wider than twice that
            // hangs off the top edge — the offsets are percentages, so a bigger scene
            // overhangs by exactly the same share. A fifth of the smaller scene is still
            // 42px of glass to press, with 83px between the two of them.
            className="cursor-target absolute h-[20%] w-[20%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-accent/40 hover:border-accent"
            style={{ left: `${(m.x / VIEW) * 100}%`, top: `${(m.y / VIEW) * 100}%` }}
          />
        ))}
      </div>
      <span id={`${id}-hint`} className={`${FINE} text-neutral-400`}>
        {labels.laserHint}
      </span>
      {/* One region for all three readings, and each of them names where the beam ended
          up: on the rocket, in the floor, or out of the near side. It speaks whenever the
          wording changes, so a turn that moves the beam from one wall to the other is
          heard — which is what makes the puzzle solvable with the screen off. */}
      <span role="status" className={`${FINE} text-neutral-400`}>
        {beam.hit
          ? labels.laserStatusHit
          : edge === 'bottom'
            ? labels.laserStatusBottom
            : labels.laserStatusLeft}
      </span>
    </div>
  );
}

/**
 * The lock cover: three wheels and the lever that tries them. Where the code stands is
 * never read — `guess` takes no code and never did — so the wheels only have to turn,
 * and turning them is the whole of the quest.
 */
function CodeLock({
  id,
  code,
  labels,
  onTry,
}: {
  id: ChapterId;
  code: string;
  labels: Labels;
  onTry: () => void;
}) {
  const scope = useRef<HTMLDivElement>(null);
  const [wheels, setWheels] = useState([0, 0, 0]);
  // Config only, no callback: nothing runs on mount here. The hook is for the context
  // the tick below is created in — a tween made loose in a handler would outlive the
  // cover it belongs to, exactly as the rocket's mirrors would.
  const { contextSafe } = useGSAP({ scope });

  const spin = contextSafe((i: number, delta: 1 | -1) => {
    setWheels((w) => w.map((d, j) => (j === i ? dial(d, delta) : d)));
    // The digit rolls in from the side the press came from — up-press, up from below.
    // React owns the character and GSAP owns the transform, so the two never contest
    // the same property; with motion turned down there is no tween, just the new digit.
    const digit = scope.current?.querySelector(`[data-wheel="${i}"]`);
    if (digit && matchMedia('(prefers-reduced-motion: no-preference)').matches)
      gsap.fromTo(
        digit,
        { y: delta * 10 },
        { y: 0, duration: 0.18, ease: 'power1.out', overwrite: 'auto' },
      );
  });

  return (
    <div ref={scope} className={`${COVER} justify-center-safe`}>
      {stamp(code, labels.classified, id)}
      <span aria-hidden="true" className={BIG}>
        ?
      </span>
      <span id={`${id}-prompt`} className={HINT}>
        {labels.guessPrompt}
      </span>
      {/* A group named by the prompt, and no live region on the digits: a wheel that
          reads itself out on every press talks over a visitor working three of them.
          Not a spinbutton either — the APG pattern names one focusable element holding
          the value, with the arrow keys on it; here the two arrows are the controls,
          and claiming the role without its keyboard contract is a promise the cover
          would not keep. Each button is named by its direction and the digit the wheel
          is standing on — "raise digit 3" — because the digit between the two arrows is
          the one thing a visitor working this by ear cannot see. */}
      <div role="group" aria-labelledby={`${id}-prompt`} className="flex items-center gap-2">
        {wheels.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <button
              type="button"
              aria-label={`${labels.wheelUp} ${d}`}
              onClick={() => spin(i, 1)}
              className={`cursor-target ${QUEST_BTN}`}
            >
              ▲
            </button>
            <span data-wheel={i} className="font-mono text-xl text-neutral-100">
              {d}
            </span>
            <button
              type="button"
              aria-label={`${labels.wheelDown} ${d}`}
              onClick={() => spin(i, -1)}
              className={`cursor-target ${QUEST_BTN}`}
            >
              ▼
            </button>
          </div>
        ))}
        <button type="button" onClick={onTry} className={`cursor-target ${QUEST_BTN}`}>
          {labels.guessHint}
        </button>
      </div>
    </div>
  );
}

// Which way each file comes in once its cover is off. Fixed per chapter rather than
// random, so a visitor who opens the same file twice in two sessions sees the same
// thing happen, and cycled so no two files in a row arrive the same way.
const REVEALS: Record<ChapterId, 'resolve' | 'blueprint' | 'scan'> = {
  'FILE-01': 'resolve',
  'FILE-02': 'blueprint',
  'FILE-03': 'scan',
  'FILE-04': 'resolve',
  'FILE-05': 'blueprint',
  'FILE-06': 'scan',
  'FILE-07': 'resolve',
};

/**
 * The card an opened file landed in, arriving. Three ways of doing it: a photo pulling
 * into focus, a print coming up out of its wash, a scan coming down the frame. Nothing
 * here decides anything — the file is already open and already where it ends up, which
 * is why the caller can skip the whole of it when motion is unwelcome and lose nothing
 * but the arrival. Null-tolerant like `paint` above: what it is handed comes off a
 * query that is allowed to miss.
 */
function reveal(card: Element | null | undefined, id: ChapterId): void {
  if (!card) return;
  switch (REVEALS[id]) {
    case 'resolve':
      // Dropped at the end like the other two, and for the same reason: where the tween
      // lands is where the stylesheet was going to put the card anyway, so writing it out
      // buys nothing and costs an inline declaration no later rule of ours can outrank.
      gsap.from(card, {
        filter: 'blur(16px)',
        scale: 1.02,
        duration: 0.45,
        clearProps: 'filter,scale',
      });
      return;
    case 'blueprint':
      // The one that has to be written out at both ends. A card with no filter of its
      // own computes to `none`, and a one-ended tween finds no number in that to come
      // back to, so it travels toward zero and only snaps to `none` on the last frame.
      // Zero is where a softened edge and a rolled-up scan are heading anyway; for a
      // brightness it is black, so this one alone would darken all the way down and
      // pop. Both ends spelled out, then the property dropped so the card is bare.
      gsap.fromTo(
        card,
        { filter: 'saturate(0) brightness(1.6) contrast(1.4)' },
        { filter: 'saturate(1) brightness(1) contrast(1)', duration: 0.5, clearProps: 'filter' },
      );
      // The frame comes up with it, and this is the one place the accent is typed out
      // rather than read: the card's resting border is a `color-mix` in oklab, which
      // the tween engine cannot read as a colour at all — it takes the three oklab
      // coordinates for red, green and blue and walks the border to near-black. So
      // both ends are literals of the same token, `--color-accent` at full and at the
      // 40% the class asks for, and dropping the property hands the class back.
      gsap.fromTo(
        card,
        { borderColor: '#b497cf' },
        { borderColor: '#b497cf66', duration: 0.5, clearProps: 'borderColor' },
      );
      return;
    case 'scan':
      gsap.from(card, {
        clipPath: 'inset(0 0 100% 0)',
        duration: 0.45,
        ease: 'power2.inOut',
        clearProps: 'clipPath',
      });
      return;
  }
}

export default function Nda() {
  const { title, intro, labels, chapters, archive, clearanceTitle, clearance, dialog } =
    content[useLang()].sector.nda;
  const t = useT();
  const scope = useRef<HTMLElement>(null);
  const [openAt, setOpenAt] = useState<ChapterId | null>(null);
  // The control a visitor pressed goes away with the cover it lifted, and focus goes
  // with it — to <body>, which restarts tabbing at the top of the page. The photo
  // that replaced it is the honest landing place, so the quest names it on the way
  // out and the effect below hands focus over once it has actually rendered.
  const justOpened = useRef<ChapterId | null>(null);
  // Answering the guard costs the same three buttons their place in the tab order, and
  // nothing is unlocked yet. The card itself is where the visitor was standing and is
  // now the control that opens the file, so focus lands there and reads his answer out.
  const justChose = useRef<ChapterId | null>(null);
  // The sprint's clock. Only the pedalling reads it, and only while it is falling.
  const [now, setNow] = useState(0);
  const frame = useRef(0);

  // The count of moves the case file has taken, which is what the arrival below waits on:
  // every quest verb bumps it, so the render that lands an open file is the render after
  // the bump — whoever asked for it, a cover under the visitor's hand or a code typed at
  // the agent on the other side of the board.
  const version = useSyncExternalStore(subscribe, getVersion);

  // The rocket's door, and the one quest whose unlock is on a clock rather than on a
  // click: the panel holds this in a timer for the length of its hit-frame, so it has to
  // be the same function on the other side of a re-render. The photo is claimed first —
  // the store's answer takes the cover away and the focus with it.
  const ignite = useCallback((chapter: ChapterId) => {
    justOpened.current = chapter;
    laserIgnite(chapter);
  }, []);

  // Which files have already come in. The first pass fills this and owes nothing: a view
  // that mounts on a case already part-way through — a route back, the CV quest already
  // won on another page — has files to show, not files arriving. Every id that turns up
  // unlocked after that is one that was just unlocked, and its file arrives whatever took
  // the cover off. A pass that runs twice on mount, as the development build's double
  // invoke does, finds its own baseline and stays still.
  const arrived = useRef<Set<ChapterId> | null>(null);

  // Before the paint, and inside the hook's own context, which is what these tweens need
  // on both counts: a `from` reads the card's painted values as the end it comes back to,
  // so a pass running after the paint shows the finished card for a frame and only then
  // starts from the blur — and a tween created loose would outlive the view that owns it.
  useGSAP(
    () => {
      const first = arrived.current === null;
      const seen = (arrived.current ??= new Set<ChapterId>());
      const opened = justOpened.current;
      const chose = justChose.current;
      justOpened.current = null;
      justChose.current = null;
      // The handoff, and only for a cover the visitor was standing on when it went: the
      // control he pressed is gone with it and focus went to <body>, which restarts
      // tabbing at the top of the page. It is no longer what decides the arrival — a file
      // opened by a word typed at the agent leaves him typing, and moving the cursor out
      // of the field would be the site answering him by taking his hands off the keys.
      if (opened || chose)
        scope.current
          ?.querySelector<HTMLElement>(
            opened ? `[data-photo="${opened}"]` : `[data-dialog="${chose}"]`,
          )
          ?.focus();
      // What arrives is the card — the framed box the photo and its caption share, and
      // the only element here carrying a border to bring up with it. Focus, where there
      // was any to move, is already gone by here, so nothing a visitor is waiting on sits
      // behind the motion; and with motion turned down there is nothing to run at all,
      // the file being already open and already where it ends up.
      for (const id of CHAPTERS) {
        if (!isUnlocked(id) || seen.has(id)) continue;
        seen.add(id);
        if (!first && matchMedia('(prefers-reduced-motion: no-preference)').matches)
          reveal(scope.current?.querySelector(`[data-card="${id}"]`), id);
      }
    },
    { scope, dependencies: [version] },
  );

  // The pedal loop is the only frame work on this page; it must not outlive the view.
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // Two ways in, and neither announces itself. The flag may already be set when this
  // view mounts — the loot table is a route away, the pinned CV strip is on every
  // page — which the first call catches. It may also be set while the view is open,
  // by that same pinned strip: the strip lives outside the board and re-renders
  // nothing here, and cvFlag.ts notifies nobody on purpose, being entry-bundle code
  // that imports nothing. So the second reading hangs off the click itself, which is
  // cheaper than giving one boolean a subscriber list. syncCvQuest is idempotent and
  // belongs in an effect, never in render: it mutates, and a snapshot may not.
  useEffect(() => {
    syncCvQuest();
    document.addEventListener('click', syncCvQuest);
    return () => document.removeEventListener('click', syncCvQuest);
  }, []);

  useGSAP(
    () => {
      if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries)
            if (e.isIntersecting) {
              // Once per row: this is an entrance, not a scroll effect.
              io.unobserve(e.target);
              // Opacity alone, never autoAlpha. The handoff that follows an unlock is
              // itself what scrolls some rows into view, and the `visibility: hidden`
              // half of autoAlpha makes Chrome drop the focus the row has just been
              // given, with nothing left to hand it back. At zero opacity it keeps it.
              gsap.from(e.target, { opacity: 0, y: 12, duration: 0.3, ease: 'power1.out' });
              // The run into this row draws itself as the row arrives. scaleY, not
              // stroke-dashoffset: the locked style already owns stroke-dasharray and the
              // two techniques collide over that one attribute. The first row has nothing
              // above it to run from, hence the guard — an empty target is a console line.
              const wave = e.target.querySelector('[data-wave]');
              if (wave)
                gsap.from(wave, {
                  scaleY: 0,
                  transformOrigin: 'top',
                  duration: 0.5,
                  ease: 'power2.out',
                });
            }
        },
        { rootMargin: '0px 0px -8%' },
      );
      for (const row of scope.current?.querySelectorAll('[data-tile]') ?? []) io.observe(row);
      return () => io.disconnect();
    },
    // Deliberately dependency-free: all seven rows exist from mount and only their
    // contents change when a cover lifts, so each element is tweened exactly once. A
    // `from` reads the element's current values as its END values, so a second one
    // starting mid-tween would bake in a half-faded opacity and ratchet it down for
    // good; unobserving on the first hit is what makes that second one impossible.
    { scope, revertOnUpdate: true },
  );

  // One push of the pedals. The speed coasts back down between them, so the digit needs
  // a clock — but only for as long as there is something left to count down: the loop
  // is started by a push and stops itself the frame the digit reads 0. A card nobody
  // has touched never asks for a frame at all.
  function pedal(id: ChapterId) {
    cancelAnimationFrame(frame.current);
    if (sprintPush(id, performance.now())) {
      justOpened.current = id;
      return;
    }
    const step = () => {
      const at = performance.now();
      setNow(at);
      if (Math.round(sprintSpeed(id, at)) > 0) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  }

  // One cover per chapter, and the cover is the quest. Where the mechanic is nothing
  // but a click the whole row is the button and the file number plus the hint line is
  // its name; where it needs wheels or a choice the row stays a plain box with controls
  // inside, because a button may contain neither.
  function cover(id: ChapterId, code: string) {
    const hintId = `${id}-hint`;
    switch (QUESTS[id]) {
      case 'knock':
        return (
          <button
            type="button"
            onClick={() => {
              if (knock(id)) justOpened.current = id;
            }}
            aria-labelledby={`${id}-code ${hintId}`}
            className={`cursor-target ${COVER} justify-center-safe`}
          >
            {stamp(code, labels.classified, id)}
            {/* Bare: what the number is counting up to is the riddle, and printing a
                denominator beside it answers the riddle. */}
            <span aria-hidden="true" className={BIG}>
              {knockCount(id)}
            </span>
            <span id={hintId} className={HINT}>
              {labels.knockHint}
            </span>
          </button>
        );
      case 'sprint':
        return (
          <button
            type="button"
            onClick={() => pedal(id)}
            aria-labelledby={`${id}-code ${hintId}`}
            className={`cursor-target ${COVER} justify-center-safe`}
          >
            {stamp(code, labels.classified, id)}
            <span aria-hidden="true" className={BIG}>
              {Math.round(sprintSpeed(id, now))}
            </span>
            <span id={hintId} className={HINT}>
              {labels.sprintHint}
            </span>
          </button>
        );
      case 'dialog': {
        const { phase, choice } = dialogState(id);
        if (phase === 'ask')
          return (
            <div className={`cursor-target ${COVER} justify-center-safe`}>
              {stamp(code, labels.classified, id)}
              <span id={`${id}-npc`} className={SAID}>
                {dialog.npc}
              </span>
              {/* A group, not a radiogroup: APG arrow-key semantics would say a line
                  out loud while the visitor was still reading down the list. The three
                  lines are answers to what the guard just said and are set to the same
                  measure, so they read as a reply and not as three page-wide banners. */}
              <div
                role="group"
                aria-labelledby={`${id}-npc`}
                className="flex w-full max-w-2xl flex-col gap-1"
              >
                {dialog.choices.map((c, i) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      dialogChoose(id, i as 0 | 1 | 2);
                      justChose.current = id;
                    }}
                    className={`${QUEST_BTN} text-left`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          );
        return (
          <button
            type="button"
            data-dialog={id}
            onClick={() => {
              if (dialogOpen(id)) justOpened.current = id;
            }}
            // The file number, what he said, and what it bought, in that order: this is
            // the one cover whose name carries an outcome, because the outcome is the
            // reward.
            aria-labelledby={`${id}-code ${id}-outcome ${hintId}`}
            className={`cursor-target ${COVER} justify-center-safe`}
          >
            {stamp(code, labels.classified, id)}
            <span id={`${id}-outcome`} className={SAID}>
              {dialog.outcomes[choice ?? 0]}
            </span>
            <span id={hintId} className={HINT}>
              {labels.dialogOpenHint}
            </span>
          </button>
        );
      }
      case 'guess':
        return (
          <CodeLock
            id={id}
            code={code}
            labels={labels}
            // The lever never reads the wheels. Any code is the right code — the medal
            // in the photo already says which one, and the reward line is the joke.
            onTry={() => {
              if (guess(id)) justOpened.current = id;
            }}
          />
        );
      case 'laser':
        return (
          <Laser id={id} code={code} labels={labels} onIgnite={ignite} />
        );
      // Nothing to press on these two: one waits on a download, one on the agent.
      case 'cv':
        return (
          <div className={`${COVER} justify-center-safe`}>
            {stamp(code, labels.classified, id)}
            <span aria-hidden="true" className={BIG}>
              CV
            </span>
            <span className={HINT}>{labels.cvHint}</span>
          </div>
        );
      case 'declassify':
        return (
          <div className={`${COVER} justify-center-safe`}>
            {stamp(code, labels.classified, id)}
            {/* Four dots, no letter-spacing: the mark is a redaction, and a redaction is
                one shape. Tracked apart it becomes four blanks to be counted, which is a
                different riddle from the one this cover is asking. */}
            <span aria-hidden="true" className={BIG}>
              ••••
            </span>
            <span className={HINT}>{labels.vaiHint}</span>
          </div>
        );
    }
  }

  return (
    <section ref={scope} className="flex flex-col gap-5 p-4">
      <div>
        <h2 className="font-mono text-base tracking-widest text-accent uppercase">{title}</h2>
        <p className="mt-2 max-w-2xl text-base text-neutral-400">{intro}</p>
      </div>

      {/* Ordered, not decorated: the chapters run in one sequence, and an <ol> is the
          only place that says so. The role is spelled out because a list with its
          markers styled off is a list some engines drop from the accessibility tree,
          and dropping it takes the count with it. */}
      <ol role="list" className="flex flex-col gap-3">
        {CHAPTERS.map((id, i) => {
          const ch = chapters[i];
          const [w, h] = DIMS[id];
          const p = photoSlug(id);
          return (
            <li key={id} data-tile>
              {/* The run between one file and the next, drawn outside the frame because it
                  belongs to neither: accent where the file it leads into is open, a dashed
                  grey approach where it is not. Scenery only — the <ol> is what carries the
                  order — so it is hidden rather than described. Its spine runs down the
                  photo pane's half of the row while there is a pane beside the text, and
                  down the middle of the row once the two stack. */}
              {i > 0 && (
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 64"
                  className="mx-auto h-16 w-6 xl:mx-[198px]"
                >
                  <path
                    data-wave
                    d="M12 0 Q 20 16 12 32 T 12 64"
                    fill="none"
                    className={isUnlocked(id) ? 'stroke-accent' : 'stroke-neutral-600'}
                    strokeDasharray={isUnlocked(id) ? undefined : '4 4'}
                  />
                </svg>
              )}
              {/* The frame, and the id on it is how an arriving file finds its own card.
                  The cover-to-photo swap happens inside it, and the frame is the thing
                  seen to arrive: it holds the photo and the caption together, it carries
                  the border, and it leaves out the run that leads into it — which belongs
                  to neither file and would be clipped or blurred along with this one.
                  The border stays on this element and not on a wrapper inside it: the
                  blueprint arrival tweens the border of whatever `data-card` names, and
                  the two parting company would kill that half of the reveal in silence. */}
              <div data-card={id} className="relative border border-dashed border-accent/40">
                <Corners />
                {isUnlocked(id) ? (
                  <figure className="flex max-xl:flex-col">
                    {/* A real button, not a click handler on the image: the photo is
                        cropped to one square — the set runs from a 1.78 landscape to a
                        1:1.78 portrait — so opening the uncropped file is an action and
                        has to be reachable from the keyboard. Its accessible name is the
                        alt text inside it — no aria-label, which would hide that. */}
                    <button
                      type="button"
                      data-photo={id}
                      onClick={() => setOpenAt(id)}
                      className="cursor-target block w-full xl:w-[420px] xl:shrink-0"
                    >
                      <picture>
                        <source
                          type="image/avif"
                          srcSet={`/photos/${p}-640.avif 640w, /photos/${p}-1280.avif ${w}w`}
                          sizes={SIZES}
                        />
                        <img
                          src={`/photos/${p}-1280.jpg`}
                          alt={ch.alt}
                          width={w}
                          height={h}
                          loading="lazy"
                          decoding="async"
                          className="aspect-square w-full object-cover"
                        />
                      </picture>
                    </button>
                    {/* A column rather than a stack of paragraphs, so the three parts can
                        take their own places in it: the file's markings at the top, the
                        credit pinned to the foot, and the story on the auto margins that
                        divide whatever is left — which centres it against the photo beside
                        it. Stacked, there is no slack to divide and the autos are not
                        asked for at all: the story keeps the same small gap under the
                        title that the title keeps under the code, so the three read as one
                        block. Left-aligned throughout: a cover is centred, an open file
                        is read. */}
                    <figcaption className="flex flex-1 flex-col p-4">
                      <p className={`${CAPS} text-accent`}>{ch.code}</p>
                      <p className="mt-1 text-xl font-semibold text-neutral-100">{ch.title}</p>
                      <p className="mt-1 max-w-prose text-lg text-neutral-300 xl:my-auto">
                        {ch.story}
                      </p>
                      <p className="mt-2 font-mono text-xs text-neutral-400">{ch.credit}</p>
                    </figcaption>
                  </figure>
                ) : (
                  cover(id, ch.code)
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* The marks hang off the <details> box but are written inside the <summary>: a
          shut <details> hides every child except that one, and the archive is shut until
          someone opens it. The summary is not positioned, so they still measure the frame. */}
      <details className="relative border border-dashed border-neutral-700 p-3">
        <summary className={`cursor-target ${CAPS} text-neutral-400`}>
          <Corners />
          {archive.label}
        </summary>
        <p id="archive-classified" className={`mt-3 ${CAPS} text-neutral-400`}>
          {labels.classified}
        </p>
        {/* The strike-through is what says "withheld" — the colour must not, or these
            lines fall under the 4.5:1 contrast floor while still carrying information. */}
        <ul aria-labelledby="archive-classified" className="mt-1 space-y-1">
          {archive.classified.map((c) => (
            <li key={c} className="text-base text-neutral-400 line-through">
              {c}
            </li>
          ))}
        </ul>
        <p id="archive-declassified" className={`mt-3 ${CAPS} text-neutral-400`}>
          {labels.declassified}
        </p>
        <ul
          aria-labelledby="archive-declassified"
          className="mt-1 list-disc space-y-1.5 pl-5 text-base text-neutral-300 marker:text-accent"
        >
          {archive.declassified.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </details>

      <div>
        <h3 className="font-mono text-sm tracking-widest text-neutral-400 uppercase">
          {clearanceTitle}
        </h3>
        <p className="mt-2 max-w-2xl text-base text-neutral-400">{clearance}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {[
            { href: '/loot', label: t('loot.title') },
            { href: '/contact', label: t('contact.title') },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="cursor-target rounded-md border border-dashed border-accent/50 px-3 py-1.5 text-base text-neutral-200 hover:border-accent"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      <Lightbox chapters={CHAPTERS} openAt={openAt} onClose={() => setOpenAt(null)} />
    </section>
  );
}
