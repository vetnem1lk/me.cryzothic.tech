const LOOT = [
  {
    href: '/cv/Klimentev_Vladislav_CPP_Developer_EN.pdf',
    name: 'Resume EN — visual',
    tier: 'epic drop',
  },
  {
    href: '/cv/Klimentev_Vladislav_CPP_Developer_RU.pdf',
    name: 'Resume RU — visual',
    tier: 'epic drop',
  },
  {
    href: '/cv/Klimentev_Vladislav_CPP_Developer_EN_ATS.pdf',
    name: 'Resume EN — ATS plain',
    tier: 'common, parser-safe',
  },
  {
    href: '/cv/Klimentev_Vladislav_CPP_Developer_RU_ATS.pdf',
    name: 'Resume RU — ATS plain',
    tier: 'common, parser-safe',
  },
];

export default function Loot() {
  return (
    <section className="grid gap-3 p-4 sm:grid-cols-2">
      {LOOT.map((l) => (
        <a
          key={l.href}
          href={l.href}
          download
          className="cursor-target rounded-md border border-dashed border-accent/50 p-4 hover:border-accent"
        >
          <span className="block font-mono text-xs tracking-widest text-accent uppercase">
            {l.tier}
          </span>
          <span className="mt-1 block text-sm text-neutral-200">{l.name}</span>
          <span className="mt-2 block font-mono text-[11px] text-neutral-500">
            PDF ⇩ — one click, no quest required
          </span>
        </a>
      ))}
    </section>
  );
}
