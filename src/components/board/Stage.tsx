import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useRef } from 'react';
import { Link, Route, Switch, useLocation } from 'wouter';
import Briefing from './views/Briefing';
import Contact from './views/Contact';
import Loot from './views/Loot';
import Placeholder from './views/Placeholder';

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
      <nav className="flex flex-wrap gap-3 border-b border-dashed border-neutral-800 p-2 font-mono text-xs">
        <Link href="/" className={navClass}>
          ~/
        </Link>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={navClass}>
            {n.label}
          </Link>
        ))}
      </nav>
      <div ref={viewRef} className="min-h-0 flex-1 md:overflow-y-auto">
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
          <Route>
            <Briefing />
          </Route>
        </Switch>
      </div>
    </section>
  );
}
