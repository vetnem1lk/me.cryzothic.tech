// The /loot view: the resume PDFs as drops. Four files and not two, because an
// ATS parser and a human want very different documents — offering both beats
// guessing which one is on the other end of the download.
import { useT } from '../../../i18n/I18nContext';

// The file names are fixed assets; only the drop's label and rarity are copy.
const LOOT = [
  {
    href: '/cv/Klimentev_Vladislav_CPP_Developer_EN.pdf',
    nameKey: 'loot.item.enVisual',
    tierKey: 'loot.tier.epic',
  },
  {
    href: '/cv/Klimentev_Vladislav_CPP_Developer_RU.pdf',
    nameKey: 'loot.item.ruVisual',
    tierKey: 'loot.tier.epic',
  },
  {
    href: '/cv/Klimentev_Vladislav_CPP_Developer_EN_ATS.pdf',
    nameKey: 'loot.item.enAts',
    tierKey: 'loot.tier.common',
  },
  {
    href: '/cv/Klimentev_Vladislav_CPP_Developer_RU_ATS.pdf',
    nameKey: 'loot.item.ruAts',
    tierKey: 'loot.tier.common',
  },
];

export default function Loot() {
  const t = useT();

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
            {t(l.tierKey)}
          </span>
          <span className="mt-1 block text-sm text-neutral-200">{t(l.nameKey)}</span>
          <span className="mt-2 block font-mono text-[11px] text-neutral-500">{t('loot.note')}</span>
        </a>
      ))}
    </section>
  );
}
