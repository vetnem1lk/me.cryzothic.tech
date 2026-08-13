// The stage's default view — what a visitor lands on before touching anything.
// One line of who Vlad is and every door into the rest, because an unexplained
// panel next to a chat box teaches nobody where to click first.
import { Link } from 'wouter';
import { useT } from '../../../i18n/I18nContext';

// Each card is named by the sector it opens, so the label and the view's own
// heading are the same string in both languages. The engine bay and the source
// browser have no prose heading of their own, so they are named by their tab
// label — the same word in both languages — and they are listed here at all
// because the nav strip used to be the only way into them. Exported for the pin in
// commands.test.ts: every door here has to be a sector the router actually mounts.
// A table of objects is not the literal `allowConstantExport` waives, so the export
// costs this one file its fast refresh in dev — paid once, for a list that is static.
// eslint-disable-next-line react/only-export-components
export const ACTIONS = [
  { href: '/career', key: 'sector.career.title' },
  { href: '/skills', key: 'sector.skills.title' },
  { href: '/nda', key: 'sector.nda.title' },
  { href: '/loot', key: 'loot.title' },
  { href: '/3d', key: 'nav.threed' },
  { href: '/code', key: 'nav.code' },
  { href: '/contact', key: 'contact.title' },
];

const CARD =
  'cursor-target block rounded-md border border-dashed border-accent/50 px-4 py-3 text-center text-base text-neutral-200 hover:border-accent';

// The same chip VAI offers in its greeting, so the story reads as one invitation
// wherever the visitor meets it first.
const CHIP =
  'cursor-target rounded border border-dashed border-accent/60 px-2 py-0.5 font-mono text-xs text-accent hover:border-accent';

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
      <p className="max-w-md text-center text-base text-neutral-400">{t('briefing.tagline')}</p>
      <Link href="/nda" className={CHIP}>
        {t('vai.cta.story')}
      </Link>
      <div className="grid w-full max-w-lg gap-3 xl:grid-cols-2">
        {ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`${CARD} ${a.href === '/contact' ? 'xl:col-span-2' : ''}`}
          >
            {t(a.key)}
          </Link>
        ))}
      </div>
    </section>
  );
}
