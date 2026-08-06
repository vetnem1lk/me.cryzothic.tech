const CV_LINKS = [
  { href: '/cv/Klimentev_Vladislav_CPP_Developer_EN.pdf', label: 'CV EN' },
  { href: '/cv/Klimentev_Vladislav_CPP_Developer_RU.pdf', label: 'CV RU' },
]

export default function FastPath() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex min-w-0 items-baseline gap-3">
          {/* Face mark colored by the theme via mask — the 36KB traced SVG stays a
              cached static asset instead of joining the JS bundle. */}
          <span
            aria-hidden="true"
            className="h-6 shrink-0 self-center bg-accent aspect-[574/1024]"
            style={{ mask: 'url(/face-icon-tight.svg) center / contain no-repeat' }}
          />
          <span className="truncate font-semibold tracking-tight text-neutral-100">
            Vladislav Klimentev
          </span>
          <span className="hidden text-sm text-neutral-400 sm:inline">
            C++ Developer · Tools / Gameplay
          </span>
        </div>
        <nav aria-label="Quick actions" className="flex items-center gap-2">
          {CV_LINKS.map(({ href, label }) => (
            <a
              key={label}
              href={href}
              download
              className="cursor-target rounded-lg border border-dashed border-accent/45 px-3 py-1.5 text-sm font-semibold text-accent transition-colors hover:border-accent hover:bg-accent/10"
            >
              {label}
            </a>
          ))}
          <a
            href="https://github.com/vetnem1lk"
            target="_blank"
            rel="noreferrer"
            className="cursor-target px-2 py-1.5 text-sm text-neutral-300 transition-colors hover:text-white"
          >
            GitHub
          </a>
          <a
            href="https://t.me/cryzoth"
            target="_blank"
            rel="noreferrer"
            className="cursor-target hidden px-2 py-1.5 text-sm text-neutral-300 transition-colors hover:text-white sm:inline"
          >
            Telegram
          </a>
          <a
            href="mailto:klimentev.vlad@gmail.com"
            className="cursor-target hidden px-2 py-1.5 text-sm text-neutral-300 transition-colors hover:text-white md:inline"
          >
            Email
          </a>
        </nav>
      </div>
    </header>
  )
}
