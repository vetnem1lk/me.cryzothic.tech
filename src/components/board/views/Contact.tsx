const CONTACTS = [
  { href: 'https://github.com/vetnem1lk', label: 'GitHub', sub: 'vetnem1lk — this site is open source' },
  { href: 'https://t.me/cryzoth', label: 'Telegram', sub: '@cryzoth — fastest response' },
  { href: 'mailto:klimentev.vlad@gmail.com', label: 'Email', sub: 'klimentev.vlad@gmail.com' },
];

export default function Contact() {
  return (
    <section className="flex flex-col gap-4 p-4">
      <div>
        <p className="font-mono text-xs tracking-widest text-accent uppercase">
          Boss: Vlad — accepts offers
        </p>
        <div aria-hidden className="mt-1 h-2 w-full rounded-sm border border-dashed border-accent/50">
          <div className="h-full w-full rounded-sm bg-accent/70" />
        </div>
        <p className="mt-1 font-mono text-[11px] text-neutral-500">HP ∞ — direct contact is the only move that lands</p>
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
            <span className="mt-1 block font-mono text-[11px] break-all text-neutral-500">{c.sub}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
