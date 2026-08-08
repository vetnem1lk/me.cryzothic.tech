// The /nda view: the two projects that cannot be shown in full — one under an NDA,
// one an unreleased commercial product — as redacted dossiers. Each file names what
// is withheld before what is said, and the footer points at the ways to ask for more.
import { Link } from 'wouter';
import content from '../../../content.json';
import { useLang, useT } from '../../../i18n/I18nContext';

export default function Nda() {
  const { title, intro, labels, files, clearanceTitle, clearance } =
    content[useLang()].sector.nda;
  const t = useT();

  return (
    <section className="flex flex-col gap-5 p-4">
      <div>
        <h2 className="font-mono text-sm tracking-widest text-accent uppercase">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-neutral-400">{intro}</p>
      </div>
      {files.map((f) => (
        <article key={f.code} className="rounded-md border border-dashed border-accent/40 p-4">
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">{f.code}</p>
          <p className="mt-1 text-sm font-semibold text-neutral-100">{f.name}</p>
          {/* The strike-through is what says "withheld" — the colour must not, or these
              lines fall under the 4.5:1 contrast floor while still carrying information. */}
          <p
            id={`${f.code}-classified`}
            className="mt-3 font-mono text-[11px] tracking-widest text-neutral-500 uppercase"
          >
            {labels.classified}
          </p>
          <ul aria-labelledby={`${f.code}-classified`} className="mt-1 space-y-1">
            {f.classified.map((c) => (
              <li key={c} className="text-sm text-neutral-400 line-through">
                {c}
              </li>
            ))}
          </ul>
          <p
            id={`${f.code}-declassified`}
            className="mt-3 font-mono text-[11px] tracking-widest text-neutral-500 uppercase"
          >
            {labels.declassified}
          </p>
          <ul
            aria-labelledby={`${f.code}-declassified`}
            className="mt-1 list-disc space-y-1.5 pl-5 text-sm text-neutral-300 marker:text-accent"
          >
            {f.declassified.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </article>
      ))}
      <div>
        <h3 className="font-mono text-xs tracking-widest text-neutral-500 uppercase">
          {clearanceTitle}
        </h3>
        <p className="mt-2 max-w-2xl text-sm text-neutral-400">{clearance}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          {[
            { href: '/loot', label: t('loot.title') },
            { href: '/contact', label: t('contact.title') },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="cursor-target rounded-md border border-dashed border-accent/50 px-3 py-1.5 text-sm text-neutral-200 hover:border-accent"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
