// The full-size viewer behind the /nda tiles. It is a native <dialog> opened with
// showModal(), and that one call is what buys the top layer, the page underneath
// going inert, aria-modal, Esc, and focus returning to the tile that was clicked.
// There is deliberately no focus-trap code here: a hand-written trap is how these
// viewers end up holding a keyboard visitor hostage, and the platform's is correct.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import content from '../../../content.json';
import { useLang } from '../../../i18n/I18nContext';
import {
  CHAPTERS,
  DIMS,
  getVersion,
  isUnlocked,
  nextChapter,
  photoSlug,
  subscribe,
  type ChapterId,
} from '../story';

interface Props {
  /** The chapters this viewer may show, in the order the arrow keys walk them. */
  chapters: ChapterId[];
  /** Which one to open on — null closes. Locked chapters are refused. */
  openAt: ChapterId | null;
  onClose: () => void;
}

export default function Lightbox({ chapters, openAt, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const fig = useRef<HTMLElement>(null);
  // The arrows move the viewer without telling whoever opened it, so the chapter on
  // screen is local state from the first step onwards.
  const [cur, setCur] = useState<ChapterId | null>(null);
  const [asked, setAsked] = useState(openAt);
  // Every new request drops wherever the arrows left off — without this, returning to
  // the first tile opens on the last chapter seen. Done during render (React's own
  // reset-on-prop-change pattern) rather than in an effect, so nothing paints the
  // stale chapter first, and so a `close` event that never arrives cannot wedge the
  // viewer shut: the next request still gets through.
  if (asked !== openAt) {
    setAsked(openAt);
    setCur(null);
  }
  const { chapters: copy, labels } = content[useLang()].sector.nda;

  // Covers can come off while this is mounted, which changes what the arrows walk.
  useSyncExternalStore(subscribe, getVersion);

  const open = chapters.filter(isUnlocked);
  const pick = cur ?? openAt;
  // A covered chapter is never shown, however it was asked for: the covers are the
  // whole point of the view, and this is the one place that could leak past them.
  const shown = pick && open.includes(pick) ? pick : null;
  const ch = shown ? copy[CHAPTERS.indexOf(shown)] : null;

  // The dialog's open state is the derived one, not the source: React says what
  // should be on screen, and `close()` reports back through onClose either way —
  // Esc, the button, the backdrop and the browser's own dismiss all land there.
  //
  // A layout effect, and declared above the tween below, because layout effects run
  // in declaration order: this one has to open the dialog before the other animates
  // what is inside it. As a passive effect it can be deferred under concurrent
  // rendering, and the fade would then start on a figure still inside a display:none
  // dialog — the photo popping in half-faded, or already opaque.
  useLayoutEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (shown && !d.open) d.showModal();
    if (!shown && d.open) d.close();
  }, [shown]);

  // The entrance plays on every change of chapter, not only on open: stepping across
  // the set with the arrows is the same move, one size smaller. No outro on purpose —
  // closing is instant, so `cancel` is never intercepted and Esc keeps its native speed.
  useGSAP(
    () => {
      if (!shown || !matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
      gsap.fromTo(
        fig.current,
        { autoAlpha: 0, scale: 0.96 },
        { autoAlpha: 1, scale: 1, duration: 0.25, ease: 'power1.out' },
      );
    },
    { dependencies: [shown], revertOnUpdate: true },
  );

  function cycle(e: React.KeyboardEvent<HTMLDialogElement>) {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step || !shown) return;
    e.preventDefault();
    setCur(nextChapter(open, shown, step));
  }

  return (
    <dialog
      ref={ref}
      // Lowercase because that is the DOM attribute: React 19 has no `closedBy` prop,
      // and a camelCase one it does not know earns a console warning and nothing else.
      // Enhancement only — Safari has no light dismiss at all, so the click handler
      // below is the actual contract, on every browser.
      closedby="any"
      aria-label={ch?.title}
      onClose={onClose}
      onKeyDown={cycle}
      // Exact because the dialog has no padding and one child that fills it: the only
      // clicks that can land on the dialog itself are the ones on its ::backdrop.
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-auto max-h-[100dvh] max-w-[100vw] border-0 bg-transparent p-0 backdrop:bg-neutral-950/90"
    >
      {/* The dialog's only element, and it fills it — that is what makes the backdrop
          test above exact. It scrolls only on the short viewports where an 80dvh photo
          and its caption still do not fit. */}
      {shown && ch && (
        <figure
          ref={fig}
          className="scroll-thin relative max-h-[100dvh] overflow-y-auto overscroll-contain"
        >
          {/* Keyed so an arrow step mounts a fresh picture instead of reusing this
              one: the set runs from a 799×600 landscape to a 1280×2279 portrait, and a
              reused <img> holds the old bitmap, at the old shape, until the new file
              decodes. The key sits on the <picture> and not on the <img> alone, so the
              new <source> is in place before the new <img> is inserted and the browser
              cannot resolve one chapter's avif against another's fallback; and not on
              the <figure>, which would rebuild the close button and re-fire its
              autoFocus mid-cycle. */}
          <picture key={shown}>
            <source type="image/avif" srcSet={`/photos/${photoSlug(shown)}-1280.avif`} />
            {/* Never lazy and never low priority: by the time this renders, the photo
                is the only thing the visitor asked for. The width/height pair is the
                measured size of the file, which three of the seven do not get from
                their name — the `-1280` slot is a URL contract, not a promise. */}
            <img
              src={`/photos/${photoSlug(shown)}-1280.jpg`}
              alt={ch.alt}
              width={DIMS[shown][0]}
              height={DIMS[shown][1]}
              fetchPriority="high"
              decoding="async"
              className="max-h-[80dvh] w-auto max-w-[100vw] object-contain"
            />
          </picture>
          {/* Code, title and credit — the story stays on the tile. Full size is for
              looking at, and the credit is the one line that is not ours to drop. */}
          <figcaption className="bg-neutral-950/85 p-3">
            <p className="font-mono text-xs tracking-widest text-accent uppercase">{ch.code}</p>
            <p className="mt-1 text-base font-semibold text-neutral-100">{ch.title}</p>
            <p className="mt-1 font-mono text-xs text-neutral-400">{ch.credit}</p>
          </figcaption>
          <button
            type="button"
            autoFocus
            aria-label={labels.close}
            onClick={() => ref.current?.close()}
            className="cursor-target absolute top-2 right-2 rounded-md border border-dashed border-accent/50 bg-neutral-950/80 px-2 py-1 font-mono text-sm text-neutral-200 hover:border-accent"
          >
            ✕
          </button>
        </figure>
      )}
    </dialog>
  );
}
