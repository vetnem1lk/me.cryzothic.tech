// The board's right column: the nav strip and the router that swaps views under
// it. Views are imported eagerly because they are small; /code is the one
// exception and loads on demand, since it carries this site's source as text.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { Suspense, lazy, useRef } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import Briefing from './views/Briefing';
import Contact from './views/Contact';
import Loot from './views/Loot';
import Placeholder from './views/Placeholder';
import ThreeDView from './views/ThreeDView';

const CodeBase = lazy(() => import('./views/CodeBase'));

const NAV = [
  { href: '/career', label: 'career' },
  { href: '/skills', label: 'skills' },
  { href: '/nda', label: 'nda' },
  { href: '/loot', label: 'loot' },
  { href: '/contact', label: 'contact' },
];

const navClass = (active: boolean) =>
  `cursor-target px-1 ${active ? 'text-accent' : 'text-neutral-500 hover:text-neutral-300'}`;

export default function Stage() {
  const viewRef = useRef<HTMLDivElement>(null);
  const [location] = useLocation();

  useGSAP(
    () => {
      if (!matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
      gsap.from(viewRef.current, { autoAlpha: 0, y: 8, duration: 0.2, ease: 'power1.out' });
    },
    { dependencies: [location] },
  );

  return (
    <section
      data-dock
      className="flex min-h-0 flex-col border-b border-dashed border-neutral-800 md:border-b-0"
    >
      <nav className="flex flex-wrap items-center gap-3 p-2 font-mono text-[13px] font-semibold">
        <Link href="/" className={navClass}>
          ~/
        </Link>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={navClass}>
            {n.label}
          </Link>
        ))}
        <span className="flex-1" aria-hidden />
        <Link href="/code" className={navClass}>
          code_base
        </Link>
        <Link href="/3d" className={navClass}>
          3D_view
        </Link>
      </nav>
      <div aria-hidden className="sep-tri" />
      <div ref={viewRef} className="scroll-thin min-h-0 flex-1 md:overflow-y-auto">
        <Switch>
          <Route path="/career">
            <Placeholder title="Career Progression" />
          </Route>
          <Route path="/skills">
            <Placeholder title="Core Competencies" />
          </Route>
          <Route path="/nda">
            <Placeholder title="Secret Project Files (NDA)" />
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
                <p className="p-4 font-mono text-xs text-neutral-500">cloning code_base…</p>
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
