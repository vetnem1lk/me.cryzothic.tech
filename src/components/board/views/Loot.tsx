// The /loot view: the resume PDFs as drops. Four files and not two, because an
// ATS parser and a human want very different documents — offering both beats
// guessing which one is on the other end of the download.
import { useT } from '../../../i18n/I18nContext';
import { markCvDownloaded } from '../cvFlag';
import { LOOT } from './loot.data';
import { Masthead, Rail } from './Masthead';
import NextSector from './NextSector';

export default function Loot() {
  const t = useT();

  return (
    <section className="@container flex min-h-full flex-col gap-5 p-4">
      <Masthead path="/loot" count={LOOT.length}>
        <h2 className="font-mono text-base tracking-widest text-accent uppercase">
          {t('loot.title')}
        </h2>
      </Masthead>
      {/* Two columns from @md — 448 px of this section's own inline size, not the
          viewport's. The stage is a scrolled column inside the shell (~870 px at a 1280
          viewport), so the old viewport breakpoint was measuring the wrong box entirely.
          448 px is where the arithmetic turns: minus the gap, a half-width card lands
          at ~218 px, and much below that the file names wrap into a stack of
          fragments. */}
      <div className="grid gap-3 @md:grid-cols-2">
        {LOOT.map((row) => {
          // Rarity in the one colour grammar the shell already has: the epic pair
          // carries a firmer frame and an accent tier, the parser-safe pair reads grey.
          const epic = row.tierKey === 'loot.tier.epic';

          return (
            <a
              key={row.href}
              // The byte count doubles as a cache-buster: the filenames are stable
              // and sit behind a 24 h CDN TTL, so a content swap must change the URL.
              href={`${row.href}?v=${row.bytes}`}
              download
              // Noted, not intercepted: taking any drop opens a chapter of the /nda story.
              onClick={markCvDownloaded}
              // The rarity is structural before it is chromatic: a solid 2 px left edge
              // against the dashed frame, so the epic pair reads as a rank even where
              // the accent colour does not survive (greyscale print, forced colours).
              // The frame answers the pointer, the rank does not: hover's border-accent
              // is a shorthand over all four sides, so the common edge pins its grey.
              className={`cursor-target rounded-md border border-dashed p-4 hover:border-accent ${
                epic
                  ? 'border-accent/60 border-l-2 [border-left-style:solid] border-l-accent'
                  : 'border-accent/50 border-l-2 [border-left-style:solid] border-l-neutral-700 hover:border-l-neutral-700'
              }`}
            >
              <span
                className={`block font-mono text-xs tracking-widest uppercase ${
                  epic ? 'text-accent' : 'text-neutral-400'
                }`}
              >
                [ {t(row.tierKey)} ]
              </span>
              <span className="mt-1 block text-base text-neutral-200">{t(row.nameKey)}</span>
              {/* Weight and format, in the one grammar that needs no translation. */}
              <p className="font-mono text-xs text-neutral-400">
                PDF · {Math.round(row.bytes / 1024)} KB
              </p>
            </a>
          );
        })}
      </div>
      <NextSector route="/loot" />
      <Rail path="/loot" count={LOOT.length} />
    </section>
  );
}
