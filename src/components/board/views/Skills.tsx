// The /skills view: the competency board, grouped and unhedged — nothing here is
// "basics of X", because anything listed is fair game in an interview. The one
// honest caveat (where Unreal Engine actually stands) is the closing note.
import content from '../../../content.json';
import { useLang } from '../../../i18n/I18nContext';

export default function Skills() {
  const { title, groups, note } = content[useLang()].sector.skills;

  return (
    <section className="flex flex-col gap-5 p-4">
      <h2 className="font-mono text-sm tracking-widest text-accent uppercase">{title}</h2>
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.name}>
            <p className="font-mono text-[11px] tracking-widest text-neutral-500 uppercase">
              {g.name}
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {g.items.map((i) => (
                <li
                  key={i}
                  className="rounded border border-dashed border-accent/40 px-2 py-1 text-sm text-neutral-200"
                >
                  {i}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="max-w-2xl text-sm text-neutral-400">{note}</p>
    </section>
  );
}
