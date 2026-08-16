// The page shell. Two things load eagerly because a visitor in a hurry may only
// ever see them — the crosshair cursor and the CV strip — and the interactive
// board arrives behind them as a lazy chunk, so text is on screen first.
//
// It is also where the language is read off the URL. Only the JSON-free halves of
// i18n may be imported here: content.json rides the Board chunk, and one import of
// I18nContext from this file would haul the whole dictionary into the entry bundle.
import { Suspense, lazy, useEffect } from 'react';
import { navigate, usePathname } from 'wouter/use-browser-location';
import FastPath from './components/FastPath';
import TargetCursor from './components/TargetCursor';
import { langFromPath, pickInitialLocale, type Lang } from './i18n/locale';
import { STRIP } from './i18n/strip';

const Board = lazy(() => import('./components/board/Board'));

function BoardFallback({ lang }: { lang: Lang }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="font-mono text-base text-neutral-500">{STRIP[lang].loading}</p>
    </div>
  );
}

export default function App() {
  const lang = langFromPath(usePathname());

  useEffect(() => {
    document.documentElement.lang = lang;
    // The canonical must move with the language, or the RU board a Russian visitor
    // was redirected onto keeps advertising the EN URL to anything that reads the
    // rendered DOM. Origin comes off the tag itself, so no host is hardcoded here.
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical) canonical.href = new URL(lang === 'ru' ? '/ru/' : '/', canonical.href).href;
  }, [lang]);

  // Autodetect runs on the bare root only, once per load. A deep link is already a
  // deliberate choice of language, so it is never redirected out from under the
  // visitor; and replace: true keeps Back pointing at wherever they came from. The
  // query and hash ride along — a campaign's ?utm_source or a #contact anchor must
  // survive the redirect, or the Russian visitor is the one who loses it.
  useEffect(() => {
    if (window.location.pathname === '/' && pickInitialLocale(navigator.language) === 'ru')
      navigate('/ru/' + window.location.search + window.location.hash, { replace: true });
  }, []);

  return (
    <>
      <TargetCursor />
      <FastPath lang={lang} />
      <main className="flex min-h-dvh flex-col bg-neutral-950 pt-12 text-neutral-100">
        <Suspense fallback={<BoardFallback lang={lang} />}>
          <Board />
        </Suspense>
      </main>
    </>
  );
}
