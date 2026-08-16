// The board: the framed two-column layout everything else lives inside — VAI's
// terminal on the left, the routed stage on the right. A phone has no room for
// two columns, so on mobile the terminal becomes the sheet behind the VAI button.
//
// It is also the language boundary. This chunk carries content.json, so the provider
// and the router base are mounted here rather than in the entry shell; both are read
// straight off the URL every render, never from state — a base that disagrees with
// the address bar puts every route out of reach and leaves the stage blank.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useEffect, useRef, useState } from 'react';
import { Router } from 'wouter';
import { usePathname } from 'wouter/use-browser-location';
import { LangProvider, translate } from '../../i18n/I18nContext';
import { langFromPath, pathForLang } from '../../i18n/locale';
import Corners from './Corners';
import { KONAMI, advance, swipeDir, type Dir8 } from './konami';
import Marquee from './Marquee';
import Stage from './Stage';
import { konamiEntered } from './story';
import VaiShell from './VaiShell';

const ARROW: Record<string, Dir8> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export default function Board() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const scope = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const lang = langFromPath(pathname);
  // The shell's own greeting test, spelled without the router base this sits outside
  // of: a greeting is whatever has the root for its English twin, which is '/', '/ru'
  // and the canonical '/ru/' alike.
  const onGreeting = pathForLang('en', pathname) === '/';

  // Title only — spec D3 bans runtime mutation of canonical/hreflang (crawlers do not
  // run our JS, so those must stay the static head scripts/emit-ru-html.mjs emits), but
  // the tab title is read by a human whose language switch never reloads the page.
  useEffect(() => {
    document.title = translate(lang, 'meta.title');
  }, [lang]);

  // The old cheat code is listened for here, not in the terminal: the stage swaps
  // views underneath and on a phone the shell is a sheet that can be shut, while the
  // board is mounted for as long as the visitor is on the site. The arithmetic is
  // konami.ts; how far along the run is lives inside the effect, so a second mount
  // starts its own run instead of inheriting a half-finished one.
  useEffect(() => {
    let pos = 0;
    let from: [number, number] | null = null;
    const step = (dir: Dir8) => {
      pos = advance(pos, dir);
      if (pos < KONAMI.length) return;
      pos = 0;
      konamiEntered();
    };
    const onKey = (e: KeyboardEvent) => {
      // The same two doors the shell's own hotkeys check: an open viewer owns the
      // keyboard while it is open, and an arrow inside a field moves a caret.
      if (document.querySelector('dialog[open]')) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;
      const dir = ARROW[e.key];
      if (dir) step(dir);
      else pos = 0; // any other key is a wrong step, and a wrong step drops the run
    };
    const onStart = (e: TouchEvent) => {
      // The finger that just landed, and only if it is alone: a pinch is not a
      // swipe, and anchoring on the first touch would measure the wrong hand.
      const t = e.touches.length === 1 ? e.changedTouches[0] : null;
      from = t ? [t.clientX, t.clientY] : null;
    };
    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (!from || !t) return;
      const dir = swipeDir(t.clientX - from[0], t.clientY - from[1]);
      from = null;
      // A tap is how the whole board is played, so it is not a wrong step: anything
      // shorter than a swipe leaves the run exactly where it was.
      if (dir) step(dir);
    };
    document.addEventListener('keydown', onKey);
    // Passive, and nothing is prevented: the code is read off the gestures the
    // visitor was making anyway, and must never cost them a scroll.
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, []);

  useGSAP(
    () => {
      if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
      gsap
        .timeline({ defaults: { ease: 'power2.out', duration: 0.45 } })
        // clearProps is load-bearing, not tidiness: the tween lands on
        // translate(0,0) and GSAP leaves that inline, so every dock carries an
        // identity transform for the rest of the session — and an identity
        // transform is still a containing block for `position: fixed`. The
        // viewer's mobile drawer is fixed and sits inside the Stage dock, so
        // without this it anchors to the frame instead of the viewport.
        .from('[data-dock]', { autoAlpha: 0, y: 18, stagger: 0.1, clearProps: 'transform' });
    },
    { scope },
  );

  return (
    <LangProvider value={lang}>
      <Router base={lang === 'ru' ? '/ru' : ''}>
        <div
          ref={scope}
          className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col px-3 pb-3 md:h-[calc(100dvh_-_2.25rem)] md:min-h-[520px] md:flex-none"
        >
          <div className="relative flex min-h-0 flex-1 flex-col border border-dashed border-accent/40">
            <Corners />
            <Marquee />
            <div className="min-h-0 flex-1 md:grid md:grid-cols-[minmax(320px,30%)_minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] md:overflow-hidden">
              <VaiShell mobileOpen={sheetOpen} onMobileClose={() => setSheetOpen(false)} />
              {/* Mobile: plain air between chat and board. On md+ the columns sit
                  side by side and the shell's dashed right border divides them, and
                  where the shell is hidden there is nothing to separate. */}
              {onGreeting && <div aria-hidden className="h-4 md:hidden" />}
              <Stage />
            </div>
          </div>
          {!sheetOpen && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="cursor-target fixed right-3 bottom-3 z-40 rounded-md border border-dashed border-accent/60 bg-neutral-950/90 px-3 py-2 font-mono text-sm text-accent hover:border-accent md:hidden"
            >
              VAI
            </button>
          )}
        </div>
      </Router>
    </LangProvider>
  );
}
