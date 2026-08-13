// The /contact view: the three channels that actually reach Vlad, dressed as a
// boss-fight panel to stay inside the shell's fiction. No form — a form needs a
// backend to receive it, and a recruiter would rather use their own mail client.
import { useT } from '../../../i18n/I18nContext';
import { Masthead, Rail } from './Masthead';
import NextSector from './NextSector';

export default function Contact() {
  const t = useT();

  // Built here rather than at module scope so `t` can resolve the two halves that
  // are copy. GitHub and Telegram are product names and the address is an address —
  // those three stay literal in both languages, and the list is the same shape either way.
  // Ordered by how fast an answer comes back, not alphabetically: Telegram is where
  // Vlad actually replies, so it leads the row and wears the primary frame.
  const CONTACTS = [
    {
      href: 'https://t.me/cryzoth',
      label: 'Telegram',
      sub: t('contact.telegramSub'),
      primary: true,
    },
    {
      href: 'mailto:klimentev.vlad@gmail.com',
      label: t('contact.emailLabel'),
      sub: 'klimentev.vlad@gmail.com',
      primary: false,
    },
    {
      href: 'https://github.com/vetnem1lk',
      label: 'GitHub',
      sub: t('contact.githubSub'),
      primary: false,
    },
  ];

  return (
    <section className="@container flex min-h-full flex-col gap-5 p-4">
      <Masthead path="/contact" count={CONTACTS.length}>
        <h2 className="font-mono text-base tracking-widest text-accent uppercase">
          {t('contact.title')}
        </h2>
      </Masthead>
      <div>
        <p className="font-mono text-xs tracking-widest text-accent uppercase">{t('contact.boss')}</p>
        {/* The bar is decor. A dashed accent frame is what the three real links wear,
            so it borrowed their affordance — grey stops it looking clickable. The fill
            is segmented (`.gauge-fill`) and square-edged, because a smooth rounded bar
            reads as a loading percentage rather than a game meter. */}
        <div aria-hidden className="mt-1 h-2 w-full border border-dashed border-neutral-700">
          <div className="gauge-fill h-full w-full" />
        </div>
        <p className="mt-1 font-mono text-xs text-neutral-400">{t('contact.hp')}</p>
      </div>
      {/* Three across from @2xl — 672 px of this section's own inline size, not the
          viewport's: the section is a scrolled column inside the shell, so the old
          xl: breakpoint was measuring the wrong box entirely. At 672 px a third of
          the row is ~216 px, where the address soft-wraps once; under a ~624 px
          container the thirds drop below 200 px and the cards read as fragments. */}
      <div className="grid gap-3 @2xl:grid-cols-3">
        {CONTACTS.map((c) => (
          <a
            key={c.href}
            href={c.href}
            target={c.href.startsWith('http') ? '_blank' : undefined}
            rel={c.href.startsWith('http') ? 'noreferrer' : undefined}
            className={`cursor-target rounded-md border border-dashed p-4 hover:border-accent ${
              c.primary ? 'border-accent/60' : 'border-accent/50'
            }`}
          >
            <span className="block text-base text-neutral-200">{c.label}</span>
            {/* The rank is said in the same bracket grammar the loot tiers use, and it
                is copy rather than an icon so a screen reader reads it in order. */}
            {c.primary && (
              <span className="font-mono text-xs text-accent">[ {t('contact.primaryTag')} ]</span>
            )}
            <span className="mt-1 block font-mono text-sm break-words text-neutral-300">
              {c.sub}
            </span>
            {/* The same condition as the target above, said out loud: a link that
                leaves for a new tab announces it, because a screen reader user
                gets no window to watch change. The mail link stays silent — it
                opens a client, not a tab. */}
            {c.href.startsWith('http') && <span className="sr-only">{t('contact.newTab')}</span>}
          </a>
        ))}
      </div>
      <NextSector route="/contact" />
      <Rail path="/contact" count={CONTACTS.length} />
    </section>
  );
}
