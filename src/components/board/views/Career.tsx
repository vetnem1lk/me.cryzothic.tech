// The /career view: the dated work history as a timeline, newest first, with the
// olympiads and the paper listed underneath as "level-ups". The copy is authored
// per language in content.json — this file only lays it out.
import content from '../../../content.json';
import { useLang } from '../../../i18n/I18nContext';
import { Masthead, Rail } from './Masthead';

export default function Career() {
  const { title, entries, levelUpsTitle, levelUps } = content[useLang()].sector.career;

  return (
    <section className="flex min-h-full flex-col gap-5 p-4">
      <Masthead path="/career" count={entries.length}>
        <h2 className="font-mono text-base tracking-widest text-accent uppercase">{title}</h2>
      </Masthead>
      {/* md+ splits an entry into a date gutter (period + tech) and the role column, sized
          to hold the longest English period on one line and wrap the Russian ones to two. */}
      <ol className="divide-y divide-dashed divide-neutral-800">
        {entries.map((e) => (
          <li
            key={e.period}
            className="grid gap-x-4 gap-y-1 py-4 md:grid-cols-[minmax(10rem,11rem)_minmax(0,1fr)]"
          >
            <div>
              <p className="font-mono text-xs tracking-widest text-accent uppercase">{e.period}</p>
              <p className="mt-1 hidden font-mono text-xs text-neutral-400 md:block">{e.tech}</p>
            </div>
            <div>
              <p className="text-base font-semibold text-neutral-100">{e.role}</p>
              <p className="text-base text-neutral-400">{e.place}</p>
              <p className="font-mono text-xs text-neutral-400 md:hidden">{e.tech}</p>
              <ul className="mt-2 max-w-prose list-disc space-y-1.5 pl-5 text-base text-neutral-300 marker:text-accent">
                {e.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <h3 className="font-mono text-sm tracking-widest text-neutral-400 uppercase">
          {levelUpsTitle}
        </h3>
        <ul className="mt-2 max-w-prose list-disc space-y-1.5 pl-5 text-base text-neutral-300 marker:text-accent">
          {levelUps.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </div>
      <Rail path="/career" count={entries.length} />
    </section>
  );
}
