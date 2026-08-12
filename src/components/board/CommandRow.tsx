// The drifting ticker above the terminal input. It exists because nothing else
// would ever tell a visitor that typing `whoami` does something — the row is the
// discoverability layer for commands.ts, and a click runs the command.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Fragment, useEffect, useRef } from 'react';
import { COMMAND_ROW } from './commands';
import { wheelPx, wheelStep } from './wheelMath';

const DRIFT_SPEED = 14; // px/s — slow marquee-style drift
const RESUME_DELAY_MS = 2500; // idle time after manual scroll before drift resumes
const MOTION_QUERY = '(prefers-reduced-motion: no-preference)';

// ponytail: third sanctioned infinite loop (by request, after the marquee
// and the TextType label) — reduced-motion renders a static row.
export default function CommandRow({ onRun }: { onRun: (cmd: string) => void }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const motionOk = matchMedia(MOTION_QUERY).matches;

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
      // Pointer gone / focus gone means the reason to pause is gone: drift
      // resumes immediately. The idle delay stays only for wheel and touch.
      const resumeNow = () => {
        window.clearTimeout(idleTimer);
        if (!row.matches(':hover') && !row.matches(':focus-within')) paused = false;
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
      // deltaY is what a mouse wheel emits over a horizontal strip; deltaX covers
      // trackpads. Non-passive because a consumed wheel must not also scroll the page.
      // The `Infinity` max is deliberate, not a forgotten clamp: a looping track has
      // no edge at which to hand the event back, so every wheel here belongs to the
      // row — the reduced-motion path below does release at its two ends, which is
      // what keeps page scroll reachable when the row is static.
      const onWheel = (e: WheelEvent) => {
        const period = (row.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
        const next = wheelStep(row.scrollLeft, wheelPx(e, row.clientWidth), period, Infinity);
        if (next === null) return;
        e.preventDefault();
        row.scrollLeft = next;
        pause();
        resumeSoon();
      };

      row.addEventListener('scroll', wrap, { passive: true });
      row.addEventListener('pointerenter', pause);
      row.addEventListener('pointerleave', resumeNow);
      row.addEventListener('focusin', pause);
      row.addEventListener('focusout', resumeNow);
      row.addEventListener('wheel', onWheel, { passive: false });
      row.addEventListener('touchstart', pause, { passive: true });
      row.addEventListener('touchend', resumeSoon, { passive: true });
      gsap.ticker.add(tick);

      return () => {
        gsap.ticker.remove(tick);
        window.clearTimeout(idleTimer);
        row.removeEventListener('scroll', wrap);
        row.removeEventListener('pointerenter', pause);
        row.removeEventListener('pointerleave', resumeNow);
        row.removeEventListener('focusin', pause);
        row.removeEventListener('focusout', resumeNow);
        row.removeEventListener('wheel', onWheel);
        row.removeEventListener('touchstart', pause);
        row.removeEventListener('touchend', resumeSoon);
      };
    },
    { scope: rowRef },
  );

  // Reduced-motion: no drift, no loop — but the row is still a horizontal
  // scroller and a mouse wheel still only emits vertical deltas.
  useEffect(() => {
    const row = rowRef.current;
    // Read once on mount, like the useGSAP body above. Re-running on a
    // mid-session flip would tear this listener down while useGSAP never
    // re-runs, leaving the row with no wheel handler at all.
    if (!row || matchMedia(MOTION_QUERY).matches) return;
    const onWheel = (e: WheelEvent) => {
      const next = wheelStep(
        row.scrollLeft,
        wheelPx(e, row.clientWidth),
        0,
        row.scrollWidth - row.clientWidth,
      );
      if (next === null) return;
      e.preventDefault();
      row.scrollLeft = next;
    };
    row.addEventListener('wheel', onWheel, { passive: false });
    return () => row.removeEventListener('wheel', onWheel);
  }, []);

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
