// The strip pinned above everything else: CV downloads and direct contact,
// reachable without waiting for the board or working out the game shell. A
// recruiter with thirty seconds should still leave with the PDF.
import { useEffect, useRef, useState } from 'react'
import type { Lang } from '../i18n/locale'
import { STRIP } from '../i18n/strip'
// Taking a CV opens a chapter of the /nda story. The click is noted, never
// intercepted — and only through these six import-free lines, so the store that
// reads them stays board-side and out of the entry bundle.
import { markCvDownloaded } from './board/cvFlag'

/* These labels name the language of the *file*, so they read the same on /ru as on /. */
const CV_LINKS = [
  {
    href: '/cv/Klimentev_Vladislav_CPP_Developer_EN.pdf',
    label: 'CV EN',
    menuLabel: 'English · PDF',
  },
  {
    href: '/cv/Klimentev_Vladislav_CPP_Developer_RU.pdf',
    label: 'CV RU',
    menuLabel: 'Русский · PDF',
  },
]

/* py-1.5 is touch padding, so it is mobile's: the desktop strip trades it for a
   denser row (49px -> 37px) that stops reading as a second toolbar. */
const CV_BUTTON =
  'cursor-target rounded-lg border border-dashed border-accent/45 px-3 py-1.5 md:py-1 text-base font-semibold text-accent transition-colors hover:border-accent hover:bg-accent/10'

/* Mobile-only replacement for the two CV buttons: one button, a dashed dropdown
   with the language choice. Desktop keeps the flat strip. */
function CvDropdown({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative md:hidden">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`${CV_BUTTON} flex items-center gap-1.5`}
      >
        CV
        <svg
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
          className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          aria-label={STRIP[lang].cvMenu}
          className="absolute top-full right-0 mt-2 w-44 overflow-hidden rounded-lg border border-dashed border-accent/45 bg-neutral-950/95 shadow-lg backdrop-blur-sm"
        >
          {CV_LINKS.map(({ href, label, menuLabel }) => (
            <a
              key={label}
              role="menuitem"
              href={href}
              download
              onClick={() => {
                markCvDownloaded()
                setOpen(false)
              }}
              className="cursor-target block px-3 py-2.5 text-base font-semibold text-accent transition-colors hover:bg-accent/10"
            >
              {menuLabel}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FastPath({ lang }: { lang: Lang }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-[1600px] items-center justify-between gap-4 px-4 md:h-9">
        <div className="flex min-w-0 items-baseline gap-3">
          {/* Face mark colored by the theme via mask — the 9KB traced SVG stays a
              cached static asset instead of joining the JS bundle. */}
          <span
            aria-hidden="true"
            className="h-6 shrink-0 self-center bg-accent aspect-[574/1024]"
            style={{ mask: 'url(/face-icon-tight.svg) center / contain no-repeat' }}
          />
          <span className="truncate font-semibold tracking-tight text-neutral-100">
            {STRIP[lang].name}
          </span>
          <span className="hidden text-sm text-neutral-400 md:inline">{STRIP[lang].role}</span>
        </div>
        <CvDropdown lang={lang} />
        <nav aria-label={STRIP[lang].quickActions} className="hidden items-center gap-2 md:flex">
          {CV_LINKS.map(({ href, label }) => (
            <a key={label} href={href} download onClick={markCvDownloaded} className={CV_BUTTON}>
              {label}
            </a>
          ))}
          <a
            href="https://github.com/vetnem1lk"
            target="_blank"
            rel="noreferrer"
            className="cursor-target px-2 py-1.5 text-base text-neutral-300 transition-colors hover:text-white"
          >
            GitHub
          </a>
          <a
            href="https://t.me/cryzoth"
            target="_blank"
            rel="noreferrer"
            className="cursor-target px-2 py-1.5 text-base text-neutral-300 transition-colors hover:text-white"
          >
            Telegram
          </a>
          <a
            href="mailto:klimentev.vlad@gmail.com"
            className="cursor-target px-2 py-1.5 text-base text-neutral-300 transition-colors hover:text-white"
          >
            {STRIP[lang].email}
          </a>
        </nav>
      </div>
    </header>
  )
}
