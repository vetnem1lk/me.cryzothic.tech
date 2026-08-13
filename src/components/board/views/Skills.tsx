// The /skills view: the competency board, grouped and unhedged — nothing here is
// "basics of X", because anything listed is fair game in an interview. The one
// honest caveat (where Unreal Engine actually stands) is the closing note.
import content from '../../../content.json';
import { useLang } from '../../../i18n/I18nContext';

export default function Skills() {
  const { title, groups, note } = content[useLang()].sector.skills;

  return (
    <section className="flex flex-col gap-5 p-4">
      <h2 className="font-mono text-base tracking-widest text-accent uppercase">{title}</h2>
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.name}>
            <h3 className="font-mono text-sm tracking-widest text-neutral-400 uppercase">
              {g.name}
            </h3>
            {/* A chip is a token you could put on a business card; anything that reads
                as a sentence is prose and gets a line of its own below the row. Either
                list can be empty, and an empty list under a heading is a hole. */}
            {g.items.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {g.items.map((i) => (
                  <li
                    key={i}
                    className="rounded border border-dashed border-accent/40 px-2 py-1 text-base text-neutral-200"
                  >
                    {i}
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
      <p className="max-w-2xl text-base text-neutral-400">{note}</p>
    </section>
  );
}
