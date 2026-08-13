// The board's right column: the nav strip and the router that swaps views under
// it. Views are imported eagerly because they are small; /code is the one
// exception and loads on demand, since it carries this site's source as text.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Suspense, lazy, useRef, type ReactNode } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { useT } from '../../i18n/I18nContext';
import { NAV_KEY, ROUTE_PATHS, type RoutePath } from './commands';
import Briefing from './views/Briefing';
import Career from './views/Career';
import Contact from './views/Contact';
import Loot from './views/Loot';
import Nda from './views/Nda';
import Skills from './views/Skills';
import ThreeDView from './views/ThreeDView';

const CodeBase = lazy(() => import('./views/CodeBase'));

// The interactive sectors, pinned past the spacer to the right edge; everything
// else reads left to right in route order. /nda joined them when it stopped being
// a dossier and became a story you play through.
const PINNED: readonly RoutePath[] = ['/nda', '/code', '/3d'];

// wouter calls this with the active flag, so the brackets can key off it — but
// only inside the class string. `aria-current` lives on the Link elements below,
// where the component's own `location` is in scope.
const navClass = (active: boolean) =>
  `cursor-target px-1.5 py-1.5 ${
    active
      ? "text-accent before:content-['[_'] before:text-accent/60 after:content-['_]'] after:text-accent/60"
      : 'text-neutral-400 hover:text-neutral-300'
  }`;

export default function Stage() {
  const viewRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();
  const t = useT();

  useGSAP(
    () => {
      if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
      gsap.from(viewRef.current, { autoAlpha: 0, y: 8, duration: 0.2, ease: 'power1.out' });
    },
    // revertOnUpdate is load-bearing, not tidiness. `from` renders immediately and
    // captures the element's CURRENT values as its END values, so a second route
    // change inside the 0.2s window froze the view at a partial opacity — and every
    // later fade re-captured that dimmer value, a one-way ratchet only a reload
    // cleared. Reverting first hands each new tween a clean opacity 1 to aim at.
    { dependencies: [location], revertOnUpdate: true },
  );

  // The view behind each path. Built in render rather than at module scope
  // because /code's fallback is copy, and copy needs `t` — the elements are the
  // same objects JSX made one at a time before, in the same order.
  const VIEWS: Record<RoutePath, ReactNode> = {
    '/career': <Career />,
    '/skills': <Skills />,
    '/nda': <Nda />,
    '/loot': <Loot />,
    '/contact': <Contact />,
    '/code': (
      <Suspense
        fallback={<p className="p-4 font-mono text-sm text-neutral-500">{t('nav.cloning')}</p>}
      >
        <CodeBase />
      </Suspense>
    ),
    '/3d': <ThreeDView />,
  };

  return (
    <section
      data-dock
      className="flex min-h-0 flex-col border-b border-dashed border-neutral-800 md:border-b-0"
    >
      <nav className="flex flex-wrap items-center gap-2 border-b border-dashed border-neutral-800 p-2 font-mono text-sm font-semibold">
        <Link href="/" className={navClass} aria-current={location === '/' ? 'page' : undefined}>
          {t('nav.home')}
        </Link>
        {ROUTE_PATHS.filter((p) => !PINNED.includes(p)).map((p) => (
          <Link
            key={p}
            href={p}
            className={navClass}
            aria-current={location === p ? 'page' : undefined}
          >
            {t(NAV_KEY[p])}
          </Link>
        ))}
        <span
          className="flex-1 self-stretch border-r border-dashed border-neutral-800"
          aria-hidden
        />
        {PINNED.map((p) => (
          <Link
            key={p}
            href={p}
            className={navClass}
            aria-current={location === p ? 'page' : undefined}
          >
            {t(NAV_KEY[p])}
          </Link>
        ))}
      </nav>
      {/* The mobile padding is the VAI button's seat: it floats over this scroller,
          and without the reserve the last line of a view ends up underneath it. */}
      <div
        ref={viewRef}
        className="scroll-thin min-h-0 flex-1 max-md:pb-[calc(62px+env(safe-area-inset-bottom))] md:overflow-y-auto"
      >
        <Switch>
          {/* Switch reads its children flat, arrays included, and takes the first
              path that matches — so the map keeps route order and the pathless
              fallback below stays last, which is the only ordering that matters. */}
          {ROUTE_PATHS.map((p) => (
            <Route key={p} path={p}>
              {VIEWS[p]}
            </Route>
          ))}
          <Route>
            <Briefing />
          </Route>
        </Switch>
      </div>
    </section>
  );
}
