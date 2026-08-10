// The /nda view: a case file with seven covers on it. Every chapter is a photo, and
// every photo is guarded by a small joke of a quest — a knock, a number nobody
// checks, a CV that opens its own file, one word with VAI. Progress is session-long
// on purpose: reload and all seven covers are back down.
//
// Every cover is a riddle rather than a caption: one large element that changes as the
// visitor works on it, one hint line under it that never names the mechanic, and —
// wherever the mechanic is nothing but a click — the whole cover is the button, so
// there is no small control to find and the square itself is the thing you press.
//
// The two project dossiers this sector started out as are not gone; they are folded
// into the archive at the foot of the page, which is the only place on this site
// where what is withheld is printed next to what is not.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'wouter';
import content from '../../../content.json';
import { useLang, useT } from '../../../i18n/I18nContext';
import { MIRRORS, SOURCE, TARGET, VIEW, trace } from '../laser';
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

const SIZES = '(max-width: 767px) 45vw, 220px';

// A square box for the photo and the same square box for the cover that hides it:
// the set runs from a 1.78 landscape to a 1:1.78 portrait, and left to their own
// shapes the tall ones own the scroll. Cropping to one square keeps the grid a grid,
// and — because a cover measures the same as its photo — lifting one shifts nothing.
const BOX = 'aspect-square';

// Not Briefing's CHIP, which only ever looked like it: this one is the control a quest
// hands the visitor when a bare cover-press will not do — a submit, a line of dialogue.
const QUEST_BTN =
  'cursor-target rounded-md border border-dashed border-accent/50 px-2 py-1 font-mono text-xs text-neutral-200 hover:border-accent';

const CAPS = 'font-mono text-[11px] tracking-widest uppercase';

// One cover, one column: the stamp at the top, the riddle in the middle, the hint at
// the foot. A cover that IS a button wears exactly this, which is what keeps a
// pressable square from advertising itself as one — finding that out is the game.
//
// It scrolls, and that is load-bearing rather than defensive: `aspect-square` is only a
// preferred size until something inside outgrows it, and a cover that grows is a cover
// that no longer measures its own photo — one tall card drags its whole grid row with
// it, and the tile jumps when the cover finally lifts. The scroll container is what
// makes the square a hard square. `-safe` centring goes with it: plain `center`
// overflows in both directions and puts the top of a long card out of reach.
const COVER = `scroll-thin flex ${BOX} w-full flex-col items-center gap-1.5 overflow-y-auto bg-gradient-to-b from-neutral-950/80 to-neutral-900/40 p-3 text-center`;

// The riddle element: a digit or a symbol, never a word — reading it is the puzzle.
const BIG = 'block font-mono text-5xl leading-none text-neutral-100 sm:text-6xl';
const HINT = 'block text-xs leading-snug text-neutral-400';
// The rocket is the one cover carrying two lines of prose under its riddle — the hint
// and the beam's own report — so both of them shrink to buy the scene its room back.
// Colourless: the two lines rank differently, and one class list must not try to win
// a specificity argument with the other.
const FINE = 'block text-[10px] leading-snug';
// Prose on a cover, which only the dialogue has: the guard's line and his answer.
const SAID = 'block text-[11px] leading-snug text-neutral-300';

type Labels = (typeof content)['en']['sector']['nda']['labels'];

// The two lines every cover carries, whatever quest is under them.
const stamp = (code: string, classified: string) => (
  <>
    <span className={`${CAPS} block text-accent`}>{code}</span>
    <span className={`${CAPS} block text-neutral-500`}>{classified}</span>
  </>
);

// Language-neutral on purpose: the mirrors need names that never change with rotation
// and never need translating. The riddle line is what says what a mirror is for.
const MIRROR_NAMES = ['A', 'B'];
// Source → both mirrors → the rocket or the wall: the longest path the tracer can hand
// back, and therefore how many <line>s the beam is drawn with, always.
const BEAM_SEGMENTS = MIRRORS.length + 2;

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
    // A path is two to five vertices long. Segments past its end collapse onto the last
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
  onSolve,
}: {
  id: ChapterId;
  code: string;
  labels: Labels;
  onSolve: () => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const { hit } = trace(...mirrorDirs(id));

  // Instant, and before the browser paints: a panel whose beam arrives a beat late
  // reads as decoration rather than as something that is already going wrong.
  const { contextSafe } = useGSAP(() => paint(svg.current, id, false), { scope: svg });

  // Wrapped, because a tween created inside a handler escapes the hook's context and
  // would outlive the cover it belongs to.
  const turn = contextSafe((ix: 0 | 1) => {
    if (rotateMirror(id, ix)) onSolve();
    paint(svg.current, id, matchMedia('(prefers-reduced-motion: no-preference)').matches);
  });

  return (
    <div className={`${COVER} justify-between`}>
      {stamp(code, labels.classified)}
      <div className="min-h-16 w-full flex-1">
        {/* Square by its height, so the buttons' percentages and the viewBox agree at
            every tile size the grid hands out. */}
        <div className="relative mx-auto aspect-square h-full">
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
              className="cursor-target absolute h-[38%] w-[38%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-accent/40 hover:border-accent"
              style={{ left: `${(m.x / VIEW) * 100}%`, top: `${(m.y / VIEW) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <span id={`${id}-hint`} className={`${FINE} text-neutral-400`}>
        {labels.laserHint}
      </span>
      {/* One region for both readings. It speaks when the wording changes, which is
          every turn that changes the answer and none that does not — a miss followed by
          another miss is silent, and that is the honest report. */}
      <span role="status" className={`${FINE} text-neutral-500`}>
        {hit ? labels.laserStatusHit : labels.laserStatusBlocked}
      </span>
    </div>
  );
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

  useEffect(() => {
    const opened = justOpened.current;
    const chose = justChose.current;
    if (!opened && !chose) return;
    justOpened.current = null;
    justChose.current = null;
    scope.current
      ?.querySelector<HTMLElement>(opened ? `[data-photo="${opened}"]` : `[data-dialog="${chose}"]`)
      ?.focus();
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
              // Once per tile: this is an entrance, not a scroll effect.
              io.unobserve(e.target);
              gsap.from(e.target, { autoAlpha: 0, y: 12, duration: 0.3, ease: 'power1.out' });
            }
        },
        { rootMargin: '0px 0px -8%' },
      );
      for (const tile of scope.current?.querySelectorAll('[data-tile]') ?? []) io.observe(tile);
      return () => io.disconnect();
    },
    // Deliberately dependency-free: all seven tiles exist from mount and only their
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
  // but a click the whole square is the button and the hint line is its name; where it
  // needs a field or a choice the square stays a plain box with controls inside,
  // because a button may contain neither.
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
            aria-labelledby={hintId}
            className={`cursor-target ${COVER} justify-center-safe`}
          >
            {stamp(code, labels.classified)}
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
            aria-labelledby={hintId}
            className={`cursor-target ${COVER} justify-center-safe`}
          >
            {stamp(code, labels.classified)}
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
            <div className={`${COVER} justify-start`}>
              {stamp(code, labels.classified)}
              <span id={`${id}-npc`} className={SAID}>
                {dialog.npc}
              </span>
              {/* A group, not a radiogroup: APG arrow-key semantics would say a line
                  out loud while the visitor was still reading down the list. */}
              <div
                role="group"
                aria-labelledby={`${id}-npc`}
                className="flex w-full flex-col gap-1"
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
            // What he said and what it bought, in that order: this is the one cover
            // whose name has to carry the outcome, because the outcome is the reward.
            aria-labelledby={`${id}-outcome ${hintId}`}
            className={`cursor-target ${COVER} justify-start`}
          >
            {stamp(code, labels.classified)}
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
            {stamp(code, labels.classified)}
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
              className="flex items-center gap-2"
            >
              {/* The value is never read. Any number is the right number — the medal
                  in the photo already says which one, and the reward line is the joke. */}
              <input
                aria-labelledby={`${id}-prompt`}
                inputMode="numeric"
                maxLength={3}
                className="cursor-target w-12 rounded-md border border-dashed border-accent/50 bg-transparent px-2 py-1 text-center font-mono text-xs text-neutral-100"
              />
              <button type="submit" className={QUEST_BTN}>
                {labels.guessHint}
              </button>
            </form>
          </div>
        );
      case 'laser':
        return (
          <Laser
            id={id}
            code={code}
            labels={labels}
            onSolve={() => {
              justOpened.current = id;
            }}
          />
        );
      // Nothing to press on these two: one waits on a download, one on the agent.
      case 'cv':
        return (
          <div className={`${COVER} justify-center-safe`}>
            {stamp(code, labels.classified)}
            <span aria-hidden="true" className={BIG}>
              CV
            </span>
            <span className={HINT}>{labels.cvHint}</span>
          </div>
        );
      case 'declassify':
        return (
          <div className={`${COVER} justify-center-safe`}>
            {stamp(code, labels.classified)}
            {/* Four dots, no letter-spacing: at the widest step the riddle element is
                already within a few pixels of the cover, and spacing them out is what
                tips it over into a sideways scrollbar. */}
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

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {CHAPTERS.map((id, i) => {
          const ch = chapters[i];
          const [w, h] = DIMS[id];
          const p = photoSlug(id);
          return (
            <li
              key={id}
              data-tile
              className="overflow-hidden rounded-md border border-dashed border-accent/40"
            >
              {isUnlocked(id) ? (
                <figure>
                  {/* A real button, not a click handler on the image: the tile is
                      cropped to a square, so opening the uncropped photo is an action
                      and has to be reachable from the keyboard. Its accessible name is
                      the alt text inside it — no aria-label, which would hide that. */}
                  <button
                    type="button"
                    data-photo={id}
                    onClick={() => setOpenAt(id)}
                    className="cursor-target block w-full"
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
                        className={`${BOX} w-full object-cover`}
                      />
                    </picture>
                  </button>
                  <figcaption className="p-3">
                    <p className={`${CAPS} text-accent`}>{ch.code}</p>
                    <p className="mt-1 text-sm font-semibold text-neutral-100">{ch.title}</p>
                    <p className="mt-1 text-sm text-neutral-300">{ch.story}</p>
                    <p className="mt-2 font-mono text-[11px] text-neutral-500">{ch.credit}</p>
                  </figcaption>
                </figure>
              ) : (
                cover(id, ch.code)
              )}
            </li>
          );
        })}
      </ul>

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
