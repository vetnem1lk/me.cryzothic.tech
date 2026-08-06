import { Link } from 'wouter';

const ACTIONS = [
  { href: '/career', label: 'Career Progression' },
  { href: '/skills', label: 'Core Competencies' },
  { href: '/nda', label: 'Secret Project Files (NDA)' },
  { href: '/loot', label: 'Loot Table (Resume)' },
  { href: '/contact', label: 'Boss Fight (Direct Contact)' },
];

const CARD =
  'cursor-target block rounded-md border border-dashed border-accent/50 px-4 py-3 text-center text-sm text-neutral-200 hover:border-accent';

export default function Briefing() {
  return (
    <section className="flex min-h-full flex-col items-center gap-6 p-6 md:justify-center">
      <span
        aria-hidden
        className="block h-24 w-[54px] bg-accent"
        style={{
          mask: 'url(/face-icon-tight.svg) center / contain no-repeat',
          WebkitMask: 'url(/face-icon-tight.svg) center / contain no-repeat',
        }}
      />
      <p className="max-w-md text-center text-sm text-neutral-400">
        C++ developer — tools / gameplay. Pick a sector, or ask VAI about me · GAI about anything.
      </p>
      <div className="grid w-full max-w-lg gap-3 sm:grid-cols-2">
        {ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`${CARD} ${a.href === '/contact' ? 'sm:col-span-2' : ''}`}
          >
            {a.label}
          </Link>
        ))}
      </div>
    </section>
  );
}
