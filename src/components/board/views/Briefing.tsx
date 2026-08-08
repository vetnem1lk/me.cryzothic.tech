// The stage's default view — what a visitor lands on before touching anything.
// One line of who Vlad is and five doors into the rest, because an unexplained
// panel next to a chat box teaches nobody where to click first.
import { Link } from 'wouter';
import { useT } from '../../../i18n/I18nContext';

// Each card is named by the sector it opens, so the label and the view's own
// heading are the same string in both languages.
const ACTIONS = [
  { href: '/career', key: 'sector.career.title' },
  { href: '/skills', key: 'sector.skills.title' },
  { href: '/nda', key: 'sector.nda.title' },
  { href: '/loot', key: 'loot.title' },
  { href: '/contact', key: 'contact.title' },
];

const CARD =
  'cursor-target block rounded-md border border-dashed border-accent/50 px-4 py-3 text-center text-sm text-neutral-200 hover:border-accent';

export default function Briefing() {
  const t = useT();

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
      <p className="max-w-md text-center text-sm text-neutral-400">{t('briefing.tagline')}</p>
      <div className="grid w-full max-w-lg gap-3 sm:grid-cols-2">
        {ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`${CARD} ${a.href === '/contact' ? 'sm:col-span-2' : ''}`}
          >
            {t(a.key)}
          </Link>
        ))}
      </div>
    </section>
  );
}
