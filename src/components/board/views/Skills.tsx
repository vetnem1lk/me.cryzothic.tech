// The /skills view: the competency board, grouped and unhedged — nothing here is
// "basics of X", because anything listed is fair game in an interview. The one
// honest caveat (where Unreal Engine actually stands) is the closing note.
import content from '../../../content.json';
import { useLang } from '../../../i18n/I18nContext';
import { Masthead, Rail } from './Masthead';
import NextSector from './NextSector';

// Weight comes from position, not from data: the groups are already ordered
// strongest-first, so the opening group reads filled, the closing one — the branch
// still leveling — reads muted, and everything between stays dashed.
const tier = (i: number, last: number) =>
  i === 0 ? 'border-accent/60 bg-accent/10 text-neutral-100'
  : i === last ? 'border-neutral-700 text-neutral-400'
  : 'border-dashed border-accent/40 text-neutral-200';

export default function Skills() {
  const { title, groups, note, noteEyebrow } = content[useLang()].sector.skills;
  const chips = groups.reduce((a, g) => a + g.items.length, 0);

  return (
    <section className="flex min-h-full flex-col gap-5 p-4">
      <Masthead path="/skills" count={chips}>
        <h2 className="font-mono text-base tracking-widest text-accent uppercase">{title}</h2>
      </Masthead>
      <div className="grid gap-4 xl:grid-cols-2">
        {groups.map((g, i) => (
          <div key={g.name}>
            <h3 className="font-mono text-sm tracking-widest text-neutral-400 uppercase border-b border-dashed border-neutral-800 pb-1">
              {g.name}
            </h3>
            {/* A chip is a token you could put on a business card; anything that reads
                as a sentence is prose and gets a line of its own below the row. Either
                list can be empty, and an empty list under a heading is a hole. */}
            {g.items.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {g.items.map((s) => (
                  <li key={s} className={`font-mono text-sm border px-2 py-1 ${tier(i, groups.length - 1)}`}>
                    {s}
                  </li>
                ))}
              </ul>
            )}
            {g.lines.map((l) => (
              <p key={l} className="mt-2 max-w-prose text-base text-neutral-300">
                {l}
              </p>
            ))}
          </div>
        ))}
      </div>
      <div className="border border-dashed border-neutral-700 p-3">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">{noteEyebrow}</p>
        <p className="mt-1 max-w-2xl text-base text-neutral-400">{note}</p>
      </div>
      <NextSector route="/skills" />
      <Rail path="/skills" count={chips} />
    </section>
  );
}
