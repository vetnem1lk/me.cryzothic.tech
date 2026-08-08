// The board's right column: the nav strip and the router that swaps views under
// it. Views are imported eagerly because they are small; /code is the one
// exception and loads on demand, since it carries this site's source as text.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Suspense, lazy, useRef } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import { useT } from '../../i18n/I18nContext';
import Briefing from './views/Briefing';
import Career from './views/Career';
import Contact from './views/Contact';
import Loot from './views/Loot';
import Nda from './views/Nda';
import Skills from './views/Skills';
import ThreeDView from './views/ThreeDView';

const CodeBase = lazy(() => import('./views/CodeBase'));

// The paths stay English on /ru too — they are the shell's unix fiction, not copy;
// only the labels beside them are translated. The three pinned to the right edge
// below are the interactive ones; /nda joined them when it stopped being a
// dossier and became a story you play through.
const NAV = [
  { href: '/career', key: 'nav.career' },
  { href: '/skills', key: 'nav.skills' },
  { href: '/loot', key: 'nav.loot' },
  { href: '/contact', key: 'nav.contact' },
];

const navClass = (active: boolean) =>
  `cursor-target px-1 ${active ? 'text-accent' : 'text-neutral-500 hover:text-neutral-300'}`;

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

  return (
    <section
      data-dock
      className="flex min-h-0 flex-col border-b border-dashed border-neutral-800 md:border-b-0"
    >
      <nav className="flex flex-wrap items-center gap-3 border-b border-dashed border-neutral-800 p-2 font-mono text-[13px] font-semibold">
        <Link href="/" className={navClass}>
          {t('nav.home')}
        </Link>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={navClass}>
            {t(n.key)}
          </Link>
        ))}
        <span className="flex-1" aria-hidden />
        <Link href="/nda" className={navClass}>
          {t('nav.nda')}
        </Link>
        <Link href="/code" className={navClass}>
          {t('nav.code')}
        </Link>
        <Link href="/3d" className={navClass}>
          {t('nav.threed')}
        </Link>
      </nav>
      <div ref={viewRef} className="scroll-thin min-h-0 flex-1 md:overflow-y-auto">
        <Switch>
          <Route path="/career">
            <Career />
          </Route>
          <Route path="/skills">
            <Skills />
          </Route>
          <Route path="/nda">
            <Nda />
          </Route>
          <Route path="/loot">
            <Loot />
          </Route>
          <Route path="/contact">
            <Contact />
          </Route>
          <Route path="/code">
            <Suspense
              fallback={
                <p className="p-4 font-mono text-xs text-neutral-500">{t('nav.cloning')}</p>
              }
            >
              <CodeBase />
            </Suspense>
          </Route>
          <Route path="/3d">
            <ThreeDView />
          </Route>
          <Route>
            <Briefing />
          </Route>
        </Switch>
      </div>
    </section>
  );
}
