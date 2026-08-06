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
      const wrap = () => {
        const half = row.scrollWidth / 2;
        if (half > 0 && row.scrollLeft >= half) row.scrollLeft -= half;
      };
      const tick = (_time: number, deltaMs: number) => {
        if (!paused) row.scrollLeft += (DRIFT_SPEED * deltaMs) / 1000;
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
      {COMMAND_ROW.map((c, i) => (
        <Fragment key={c}>
          {i > 0 && <span className="text-neutral-700">·</span>}
          <button
            type="button"
            tabIndex={hidden ? -1 : undefined}
            onClick={() => onRun(c)}
            className="cursor-target shrink-0 px-1 font-mono text-[11px] text-neutral-400 hover:text-accent"
          >
            {c}
          </button>
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
