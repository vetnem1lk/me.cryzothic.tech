// The /contact view: the three channels that actually reach Vlad, dressed as a
// boss-fight panel to stay inside the shell's fiction. No form — a form needs a
// backend to receive it, and a recruiter would rather use their own mail client.
import { useT } from '../../../i18n/I18nContext';

export default function Contact() {
  const t = useT();

  // Built here rather than at module scope so `t` can resolve the two halves that
  // are copy. GitHub and Telegram are product names and the address is an address —
  // those three stay literal in both languages, and the list is the same shape either way.
  const CONTACTS = [
    { href: 'https://github.com/vetnem1lk', label: 'GitHub', sub: t('contact.githubSub') },
    { href: 'https://t.me/cryzoth', label: 'Telegram', sub: t('contact.telegramSub') },
    {
      href: 'mailto:klimentev.vlad@gmail.com',
      label: t('contact.emailLabel'),
      sub: 'klimentev.vlad@gmail.com',
    },
  ];

  return (
    <section className="flex flex-col gap-4 p-4">
      <div>
        <p className="font-mono text-xs tracking-widest text-accent uppercase">{t('contact.boss')}</p>
        <div aria-hidden className="mt-1 h-2 w-full rounded-sm border border-dashed border-accent/50">
          <div className="h-full w-full rounded-sm bg-accent/70" />
        </div>
        <p className="mt-1 font-mono text-[11px] text-neutral-500">{t('contact.hp')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {CONTACTS.map((c) => (
          <a
            key={c.href}
            href={c.href}
            target={c.href.startsWith('http') ? '_blank' : undefined}
            rel={c.href.startsWith('http') ? 'noreferrer' : undefined}
            className="cursor-target rounded-md border border-dashed border-accent/50 p-4 hover:border-accent"
          >
            <span className="block text-sm text-neutral-200">{c.label}</span>
            <span className="mt-1 block font-mono text-[11px] break-all text-neutral-500">
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
    </section>
  );
}
