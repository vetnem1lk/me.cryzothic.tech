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

// Slots: a 420px pane at lg, else the stage column less its chrome (24 + 2 + chat 320 + 32).
const SIZES =
  '(min-width: 1024px) 420px, (min-width: 768px) calc(100vw - 378px), calc(100vw - 58px)';

// Not Briefing's CHIP, which only ever looked like it: this one is the control a quest
// hands the visitor when a bare cover-press will not do — a submit, a line of dialogue.
const QUEST_BTN =
  'cursor-target rounded-md border border-dashed border-accent/50 px-2 py-1 font-mono text-xs text-neutral-200 hover:border-accent';

const CAPS = 'font-mono text-[11px] tracking-widest uppercase';

// One cover, one row: the stamp at the top, the riddle in the middle, the hint at the
// foot, and the crosshair around the whole of it. A cover that IS a button wears exactly
// this, which is what keeps a pressable row from advertising itself as one — finding
// that out is the game.
//
// The height is a floor rather than a fixed box. Wide, the floor is the height of the
// photo pane the cover hides, so lifting one shifts nothing; stacked, the photo sits
// above its caption and the floor only comes close, so the page moves a little. Either
// way a cover that outgrows the floor pushes its own row down instead of scrolling
// inside a square it can no longer hold. `-safe` centring stays for that case: plain
// `center` overflows in both directions and puts the top of a long card out of reach.
const COVER = `cursor-target flex min-h-[360px] w-full flex-col items-center gap-1.5 bg-gradient-to-b from-neutral-950/80 to-neutral-900/40 p-3 text-center lg:min-h-[420px]`;

// The riddle element: a digit or a symbol, never a word — reading it is the puzzle. It
// grows with the row, because on a row this size a small one reads as a caption.
const BIG = 'block font-mono text-5xl leading-none text-neutral-100 sm:text-6xl lg:text-7xl';
const HINT = 'block text-xs leading-snug text-neutral-400';
// The rocket is the one cover carrying two lines of prose under its riddle — the hint
// and the beam's own report — so both of them shrink to buy the scene its room back.
// Colourless: the two lines rank differently, and one class list must not try to win
// a specificity argument with the other.
const FINE = 'block text-[10px] leading-snug';
// Prose on a cover, which only the dialogue has: the guard's line and his answer. Capped
// at the same measure as the prose everywhere else on the page — the row is wide enough
// to run these two sentences out to a single unreadable line, and a text column is the
// one thing the extra width should not be spent on.
const SAID = 'block max-w-2xl text-[11px] leading-snug text-neutral-300';

type Labels = (typeof content)['en']['sector']['nda']['labels'];

// The two lines every cover carries, whatever quest is under them. The file number is
// id'd so a cover that is a button can say it first, before the riddle's own line.
const stamp = (code: string, classified: string, id: ChapterId) => (
  <>
    <span id={`${id}-code`} className={`${CAPS} block text-accent`}>
      {code}
    </span>
    <span className={`${CAPS} block text-neutral-500`}>{classified}</span>
  </>
);

// Language-neutral on purpose: the mirrors need names that never change with rotation
// and never need translating. The riddle line is what says what a mirror is for.
const MIRROR_NAMES = ['A', 'B'];
// Source → both mirrors → the rocket or the wall: the vertices of the longest path the
// tracer can hand back. The beam is drawn with one <line> per vertex, which is always one
// more than the path needs — the spare collapses onto the last point and draws nothing,
// and no setting ever mounts or unmounts a line.
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
    // A path is two to four vertices long. Segments past its end collapse onto the last
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

  return (
    <div className={`${COVER} justify-between`}>
      {stamp(code, labels.classified, id)}
      {/* Square by a height it is given, never by the width it is offered: the row is far
          wider than it is tall, and a square that took the width would stand a whole
          screen high and drag its row with it. These two heights are what is left inside
          the cover's own floor once the stamp and the two lines below have taken theirs,
          so the rocket's row measures what the six other rows measure. */}
      <div className="relative aspect-square h-52 lg:h-72">
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
      <span role="status" className={`${FINE} text-neutral-500`}>
        {beam.hit
          ? labels.laserStatusHit
          : edge === 'bottom'
            ? labels.laserStatusBottom
            : labels.laserStatusLeft}
      </span>
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
      gsap.from(card, { filter: 'blur(16px)', scale: 1.02, duration: 0.45 });
      return;
    case 'blueprint':
      // Both ends written out, unlike the case above. A card with no filter of its own
      // computes to `none`, and a one-ended tween reading that finds no number to come
      // back to, so it comes back to zero — which is what a softened edge wants and is
      // a black card for a brightness. The end here is the three that mean "as shot".
      gsap.fromTo(
        card,
        { filter: 'saturate(0) brightness(1.6) contrast(1.4)' },
        { filter: 'saturate(1) brightness(1) contrast(1)', duration: 0.5 },
      );
      // The frame comes up with it. The resting colour is the card's own class and is
      // never typed out here — a `from` starts at the token and hands the border back.
      gsap.from(card, {
        borderColor: getComputedStyle(document.documentElement)
          .getPropertyValue('--color-accent')
          .trim(),
        duration: 0.5,
      });
      return;
    case 'scan':
      gsap.fromTo(
        card,
        { clipPath: 'inset(0 0 100% 0)' },
        { clipPath: 'inset(0 0 0% 0)', duration: 0.45, ease: 'power2.inOut' },
      );
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

  useSyncExternalStore(subscribe, getVersion);

  // The rocket's door, and the one quest whose unlock is on a clock rather than on a
  // click: the panel holds this in a timer for the length of its hit-frame, so it has to
  // be the same function on the other side of a re-render. The photo is claimed first —
  // the store's answer takes the cover away and the focus with it.
  const ignite = useCallback((chapter: ChapterId) => {
    justOpened.current = chapter;
    laserIgnite(chapter);
  }, []);

  useEffect(() => {
    const opened = justOpened.current;
    const chose = justChose.current;
    if (!opened && !chose) return;
    justOpened.current = null;
    justChose.current = null;
    const handle = scope.current?.querySelector<HTMLElement>(
      opened ? `[data-photo="${opened}"]` : `[data-dialog="${chose}"]`,
    );
    handle?.focus();
    // Only a cover coming off has a file to bring in: answering the guard leaves his
    // cover where it was, and running an arrival over it would say otherwise. Focus is
    // already gone by here, so nothing a visitor is waiting on is behind the motion —
    // and with motion turned down there is nothing to run at all. What arrives is the
    // card — the framed box the photo and its caption share, nearest one above the
    // button, and the only element here carrying a border to bring up with it.
    if (opened && matchMedia('(prefers-reduced-motion: no-preference)').matches)
      reveal(handle?.closest('div'), opened);
  });

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
              gsap.from(e.target, { autoAlpha: 0, y: 12, duration: 0.3, ease: 'power1.out' });
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
  // its name; where it needs a field or a choice the row stays a plain box with controls
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
            className={`${COVER} justify-center-safe`}
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
            className={`${COVER} justify-center-safe`}
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
            <div className={`${COVER} justify-center-safe`}>
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
            className={`${COVER} justify-center-safe`}
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
          <div className={`${COVER} justify-center-safe`}>
            {stamp(code, labels.classified, id)}
            <span aria-hidden="true" className={BIG}>
              ?
            </span>
            <span id={`${id}-prompt`} className={HINT}>
              {labels.guessPrompt}
            </span>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (guess(id)) justOpened.current = id;
              }}
              // One line, at its own width: field then submit, with the row wide enough
              // that the longer of the two submit words — «Угадать» against "Guess" —
              // costs the field nothing. Nothing here has to shrink any more.
              className="flex items-center justify-center gap-2"
            >
              {/* The value is never read. Any number is the right number — the medal
                  in the photo already says which one, and the reward line is the joke.
                  Named and id'd anyway: a field with neither is what the browser
                  complains about, and the id is the chapter's, so two cards could
                  never share one. Autofill is off — this is a riddle, not a form.
                  Three characters wide, which is three more than it needs. */}
              <input
                id={`${id}-guess`}
                name="guess"
                aria-labelledby={`${id}-prompt`}
                inputMode="numeric"
                autoComplete="off"
                maxLength={3}
                className="cursor-target w-16 rounded-md border border-dashed border-accent/50 bg-transparent px-2 py-1 text-center font-mono text-xs text-neutral-100"
              />
              <button type="submit" className={QUEST_BTN}>
                {labels.guessHint}
              </button>
            </form>
          </div>
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
        <h2 className={`${CAPS} text-sm text-accent`}>{title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-400">{intro}</p>
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
                  className="mx-auto h-16 w-6 lg:mx-[210px]"
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
              <div className="overflow-hidden rounded-md border border-dashed border-accent/40">
                {isUnlocked(id) ? (
                  <figure className="cursor-target flex max-lg:flex-col">
                    {/* A real button, not a click handler on the image: the photo is
                        cropped to one square — the set runs from a 1.78 landscape to a
                        1:1.78 portrait — so opening the uncropped file is an action and
                        has to be reachable from the keyboard. Its accessible name is the
                        alt text inside it — no aria-label, which would hide that. */}
                    <button
                      type="button"
                      data-photo={id}
                      onClick={() => setOpenAt(id)}
                      className="cursor-target block w-full lg:w-[420px] lg:shrink-0"
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
                    <figcaption className="flex-1 p-4">
                      <p className={`${CAPS} text-accent`}>{ch.code}</p>
                      <p className="mt-1 text-sm font-semibold text-neutral-100">{ch.title}</p>
                      <p className="mt-1 text-sm text-neutral-300">{ch.story}</p>
                      <p className="mt-2 font-mono text-[11px] text-neutral-500">{ch.credit}</p>
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

      <details className="rounded-md border border-dashed border-neutral-700 p-3">
        <summary className={`cursor-target ${CAPS} text-neutral-400`}>{archive.label}</summary>
        <p id="archive-classified" className={`mt-3 ${CAPS} text-neutral-500`}>
          {labels.classified}
        </p>
        {/* The strike-through is what says "withheld" — the colour must not, or these
            lines fall under the 4.5:1 contrast floor while still carrying information. */}
        <ul aria-labelledby="archive-classified" className="mt-1 space-y-1">
          {archive.classified.map((c) => (
            <li key={c} className="text-sm text-neutral-400 line-through">
              {c}
            </li>
          ))}
        </ul>
        <p id="archive-declassified" className={`mt-3 ${CAPS} text-neutral-500`}>
          {labels.declassified}
        </p>
        <ul
          aria-labelledby="archive-declassified"
          className="mt-1 list-disc space-y-1.5 pl-5 text-sm text-neutral-300 marker:text-accent"
        >
          {archive.declassified.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </details>

      <div>
        <h3 className={`${CAPS} text-xs text-neutral-500`}>{clearanceTitle}</h3>
        <p className="mt-2 max-w-2xl text-sm text-neutral-400">{clearance}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {[
            { href: '/loot', label: t('loot.title') },
            { href: '/contact', label: t('contact.title') },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="cursor-target rounded-md border border-dashed border-accent/50 px-3 py-1.5 text-sm text-neutral-200 hover:border-accent"
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
