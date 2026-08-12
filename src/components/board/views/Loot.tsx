// The /loot view: the resume PDFs as drops. Four files and not two, because an
// ATS parser and a human want very different documents — offering both beats
// guessing which one is on the other end of the download.
import { useT } from '../../../i18n/I18nContext';
import { markCvDownloaded } from '../cvFlag';

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
    <section className="flex flex-col gap-5 p-4">
      <div>
        <h2 className="font-mono text-base tracking-widest text-accent uppercase">
          {t('loot.title')}
        </h2>
        {/* One line for the whole table: the same sentence printed on four cards was
            four times the noise and no extra information. */}
        <p className="mt-1 font-mono text-xs text-neutral-400">{t('loot.note')}</p>
      </div>
      {/* Two columns only from xl: at 768 the stage column is ~383 px, so a half-width
          card is ~185 px and the file names wrap into a stack of fragments. */}
      <div className="grid gap-3 xl:grid-cols-2">
        {LOOT.map((l) => {
          // Rarity in the one colour grammar the shell already has: the epic pair
          // carries a firmer frame and an accent tier, the parser-safe pair reads grey.
          const epic = l.tierKey === 'loot.tier.epic';

          return (
            <a
              key={l.href}
              href={l.href}
              download
              // Noted, not intercepted: taking any drop opens a chapter of the /nda story.
              onClick={markCvDownloaded}
              className={`cursor-target rounded-md border border-dashed p-4 hover:border-accent ${
                epic ? 'border-accent/60' : 'border-accent/50'
              }`}
            >
              <span
                className={`block font-mono text-xs tracking-widest uppercase ${
                  epic ? 'text-accent' : 'text-neutral-400'
                }`}
              >
                {t(l.tierKey)}
              </span>
              <span className="mt-1 block text-base text-neutral-200">{t(l.nameKey)}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
