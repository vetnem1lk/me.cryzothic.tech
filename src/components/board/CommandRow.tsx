// The drifting ticker above the terminal input. It exists because nothing else
// would ever tell a visitor that typing `whoami` does something — the row is the
// discoverability layer for commands.ts, and a click runs the command.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Fragment, useRef } from 'react';
import { COMMAND_ROW } from './commands';

const DRIFT_SPEED = 14; // px/s — slow marquee-style drift
const RESUME_DELAY_MS = 2500; // idle time after manual scroll before drift resumes

// ponytail: third sanctioned infinite loop (founder-requested, after the
// marquee and the TextType label) — reduced-motion renders a static row.
export default function CommandRow({ onRun }: { onRun: (cmd: string) => void }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const motionOk = matchMedia('(prefers-reduced-motion: no-preference)').matches;

  useGSAP(
    () => {
      const row = rowRef.current;
      if (!row || !motionOk) return;

      let paused = false;
      let idleTimer = 0;
      const pause = () => {
        paused = true;
        window.clearTimeout(idleTimer);
      };
      const resumeSoon = () => {
        window.clearTimeout(idleTimer);
        idleTimer = window.setTimeout(() => {
          if (!row.matches(':hover') && !row.matches(':focus-within')) paused = false;
        }, RESUME_DELAY_MS);
      };
      // Seamless wrap over the duplicated half — covers drift AND manual scroll.
      // Period is the first track's border box, NOT scrollWidth / 2: the row's own
      // px-3 padding counts toward scrollWidth, so half would overshoot by 6–12 px
      // and snap the row backward once per lap.
      const wrap = () => {
        const period = (row.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
        if (period > 0) while (row.scrollLeft >= period) row.scrollLeft -= period;
      };
      // Carry accumulator: at 14 px/s one frame is ~0.23 px, which an
      // integer-snapping scrollLeft rounds away every frame — a total stall.
      let carry = 0;
      const tick = (_time: number, deltaMs: number) => {
        if (paused) return;
        carry += (DRIFT_SPEED * deltaMs) / 1000;
        if (carry >= 1) {
          const px = Math.floor(carry);
          carry -= px;
          row.scrollLeft += px;
        }
      };
      const onWheel = () => {
        pause();
        resumeSoon();
      };

      row.addEventListener('scroll', wrap, { passive: true });
      row.addEventListener('pointerenter', pause);
      row.addEventListener('pointerleave', resumeSoon);
      row.addEventListener('focusin', pause);
      row.addEventListener('focusout', resumeSoon);
      row.addEventListener('wheel', onWheel, { passive: true });
      row.addEventListener('touchstart', pause, { passive: true });
      row.addEventListener('touchend', resumeSoon, { passive: true });
      gsap.ticker.add(tick);

      return () => {
        gsap.ticker.remove(tick);
        window.clearTimeout(idleTimer);
        row.removeEventListener('scroll', wrap);
        row.removeEventListener('pointerenter', pause);
        row.removeEventListener('pointerleave', resumeSoon);
        row.removeEventListener('focusin', pause);
        row.removeEventListener('focusout', resumeSoon);
        row.removeEventListener('wheel', onWheel);
        row.removeEventListener('touchstart', pause);
        row.removeEventListener('touchend', resumeSoon);
      };
    },
    { scope: rowRef },
  );

  const track = (hidden: boolean) => (
    <div aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-2 pr-2">
      {COMMAND_ROW.map((c) => (
        <Fragment key={c}>
          <button
            type="button"
            tabIndex={hidden ? -1 : undefined}
            onClick={() => onRun(c)}
            className="cursor-target shrink-0 px-1 font-mono text-[11px] text-neutral-400 hover:text-accent"
          >
            {c}
          </button>
          {/* Trailing, not leading: keeps both tracks byte-identical (the wrap
              math needs equal widths) and makes the seam gap match gap-2. */}
          <span aria-hidden className="text-neutral-700">
            ·
          </span>
        </Fragment>
      ))}
    </div>
  );

  return (
    <div ref={rowRef} className="scroll-hide flex overflow-x-auto px-3 pb-2 whitespace-nowrap">
      {track(false)}
      {motionOk && track(true)}
    </div>
  );
}
