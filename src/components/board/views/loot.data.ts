// The loot table's rows, lifted out of the view so a test can weigh them against the
// real PDFs. Pure data on purpose: this module rides in the Board chunk, so it must
// never import `node:fs` — the byte counts are authored here and pinned by
// loot.data.test.ts, which is the only place allowed to touch the file system.
export type LootRow = {
  href: string;
  nameKey: string;
  tierKey: string;
  bytes: number;
};

// The file names are fixed assets; only the drop's label and rarity are copy.
export const LOOT: LootRow[] = [
  {
    href: '/cv/Klimentev_Vladislav_CPP_Developer_EN.pdf',
    nameKey: 'loot.item.enVisual',
    tierKey: 'loot.tier.epic',
    bytes: 113123,
  },
  {
    href: '/cv/Klimentev_Vladislav_CPP_Developer_RU.pdf',
    nameKey: 'loot.item.ruVisual',
    tierKey: 'loot.tier.epic',
    bytes: 303878,
  },
  {
    href: '/cv/Klimentev_Vladislav_CPP_Developer_EN_ATS.pdf',
    nameKey: 'loot.item.enAts',
    tierKey: 'loot.tier.common',
    bytes: 80160,
  },
  {
    href: '/cv/Klimentev_Vladislav_CPP_Developer_RU_ATS.pdf',
    nameKey: 'loot.item.ruAts',
    tierKey: 'loot.tier.common',
    bytes: 85795,
  },
];
