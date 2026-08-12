// The status bar across the top of the board — the line that tells a visitor
// what this site is before any of the game furniture makes sense, and beside it
// the one hint the site gives away for free. The last slot is width only, and so
// is the second track; both are aria-hidden.
import { useSyncExternalStore } from 'react';
import { useT } from '../../i18n/I18nContext';
import { hasEarned, subscribe } from './story';

// Module scope, so useSyncExternalStore is handed the same function every render.
const cheatOn = () => hasEarned('konami');

export default function Marquee() {
  const t = useT();
  const cheat = useSyncExternalStore(subscribe, cheatOn);
  // The hint is up from the first paint — a code nobody is told about is not an
  // easter egg, it is dead code. Once it has been entered, its slot keeps the
  // payoff for the rest of the session instead of teaching what is already known.
  const phrases = [
    t('marquee.status'),
    t(cheat ? 'marquee.konamiDone' : 'marquee.konamiHint'),
    t('marquee.status'),
  ];

  return (
    <div
      data-dock
      className="flex gap-12 overflow-hidden border-b border-dashed border-neutral-800 px-3 py-1.5"
    >
      {[0, 1].map((dup) => (
        <div
          key={dup}
          aria-hidden={dup === 1 || undefined}
          className="marquee-track flex min-w-full shrink-0 justify-around gap-12 font-mono text-xs tracking-[0.2em] whitespace-nowrap text-neutral-400 uppercase"
        >
          {phrases.map((p, i) => (
            <span key={i} aria-hidden={i > 1 || undefined}>
              {p}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
