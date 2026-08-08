// The /nda view: a case file with seven covers on it. Every chapter is a photo, and
// every photo is guarded by a small joke of a quest — a knock, a number nobody
// checks, a CV that opens its own file, one word with VAI. Progress is session-long
// on purpose: reload and all seven covers are back down.
//
// The two project dossiers this sector started out as are not gone; they are folded
// into the archive at the foot of the page, which is the only place on this site
// where what is withheld is printed next to what is not.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Link } from 'wouter';
import content from '../../../content.json';
import { useLang, useT } from '../../../i18n/I18nContext';
import {
  CHAPTERS,
  QUESTS,
  clickUnlock,
  getVersion,
  guess,
  isUnlocked,
  knock,
  knockCount,
  subscribe,
  syncCvQuest,
  type ChapterId,
} from '../story';

// The intrinsic size of each `-1280` derivative, measured on the encoded files. Three
// of them are narrower than the slot name suggests, because the encoder refused to
// upscale a small original — so the width/height attributes and the `w` descriptor
// both come from here and never from the file name. Wrong numbers are layout shift.
const DIMS: Record<ChapterId, [number, number]> = {
  'FILE-01': [799, 600],
  'FILE-02': [855, 1280],
  'FILE-03': [1280, 1703],
  'FILE-04': [1280, 853],
  'FILE-05': [960, 1280],
  'FILE-06': [1280, 2279],
  'FILE-07': [1280, 720],
};

const SIZES = '(max-width: 767px) 45vw, 220px';

// A square box for the photo and the same square box for the cover that hides it:
// the set runs from a 1.78 landscape to a 1:1.78 portrait, and left to their own
// shapes the tall ones own the scroll. Cropping to one square keeps the grid a grid,
// and — because a cover measures the same as its photo — lifting one shifts nothing.
const BOX = 'aspect-square';

const CHIP =
  'cursor-target rounded-md border border-dashed border-accent/50 px-2 py-1 font-mono text-xs text-neutral-200 hover:border-accent';

const CAPS = 'font-mono text-[11px] tracking-widest uppercase';

export default function Nda() {
  const { title, intro, labels, chapters, archive, clearanceTitle, clearance } =
    content[useLang()].sector.nda;
  const t = useT();
  const scope = useRef<HTMLElement>(null);

  useSyncExternalStore(subscribe, getVersion);

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

  // One control per cover, and the control is the quest. The three 'click' slots are
  // holding places until real quests move in behind them.
  function questUi(id: ChapterId) {
    switch (QUESTS[id]) {
      case 'knock':
        return (
          <>
            {/* "0/3" is the whole accessible name without this: a progress reading
                with nothing saying what it counts or what pressing it does. */}
            <button
              type="button"
              onClick={() => knock(id)}
              aria-describedby={`${id}-hint`}
              className={CHIP}
            >
              {knockCount(id)}/3
            </button>
            <p id={`${id}-hint`} className="text-xs text-neutral-400">
              {labels.knockHint}
            </p>
          </>
        );
      case 'guess':
        return (
          <>
            <p id={`${id}-prompt`} className="text-xs text-neutral-400">
              {labels.guessPrompt}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                guess(id);
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
              <button type="submit" className={CHIP}>
                {labels.guessHint}
              </button>
            </form>
          </>
        );
      // Nothing to click on these two: one waits on a download, one on the agent.
      case 'cv':
        return <p className="text-xs text-neutral-400">{labels.cvHint}</p>;
      case 'declassify':
        return <p className="text-xs text-neutral-400">{labels.vaiHint}</p>;
      default:
        return (
          <button type="button" onClick={() => clickUnlock(id)} className={CHIP}>
            {labels.clickHint}
          </button>
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
          const p = `ch-${id.slice(5)}`;
          return (
            <li
              key={id}
              data-tile
              className="overflow-hidden rounded-md border border-dashed border-accent/40"
            >
              {isUnlocked(id) ? (
                <figure>
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
                      className={`cursor-target ${BOX} w-full object-cover`}
                    />
                  </picture>
                  <figcaption className="p-3">
                    <p className={`${CAPS} text-accent`}>{ch.code}</p>
                    <p className="mt-1 text-sm font-semibold text-neutral-100">{ch.title}</p>
                    <p className="mt-1 text-sm text-neutral-300">{ch.story}</p>
                    <p className="mt-2 font-mono text-[11px] text-neutral-500">{ch.credit}</p>
                  </figcaption>
                </figure>
              ) : (
                <div
                  className={`flex ${BOX} flex-col items-center justify-center gap-2 bg-gradient-to-b from-neutral-950/80 to-neutral-900/40 p-3 text-center`}
                >
                  <p className={`${CAPS} text-accent`}>{ch.code}</p>
                  <p className={`${CAPS} text-neutral-500`}>{labels.classified}</p>
                  {questUi(id)}
                </div>
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
    </section>
  );
}
