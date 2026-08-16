// Pure URL<->language helpers. The URL is the single source of truth for the
// site language: /ru/* is Russian, everything else is English. No storage.
export type Lang = 'en' | 'ru';

// Segment-aware on purpose: '/rules' must stay EN even though it starts with 'ru'.
// Case-folded because wouter matches the router base case-insensitively, so a
// hand-typed '/RU/career' mounts the Russian router regardless — the language
// read off the same URL must not be the one thing that disagrees with it.
export const langFromPath = (path: string): Lang => {
  const p = path.toLowerCase();
  return p === '/ru' || p.startsWith('/ru/') ? 'ru' : 'en';
};

export const pickInitialLocale = (navLang: string | undefined): Lang =>
  navLang?.toLowerCase().startsWith('ru') ? 'ru' : 'en';

// '/career' <-> '/ru/career'; roots map to roots. The RU root is '/ru/' with the
// slash, because that is the form canonical and hreflang name — one URL per page,
// not two that happen to both resolve.
export const mirrorPath = (path: string): string => {
  if (langFromPath(path) === 'ru') return path.slice(3) || '/';
  return path === '/' ? '/ru/' : `/ru${path}`;
};

// What the greeting chip links to: the mirrored location, whole. `~` escapes the
// router base, and the query and hash ride along — a switch that drops
// ?utm_source loses the campaign that paid for the visit.
export const mirrorTarget = (pathname: string, search: string, hash: string): string =>
  '~' + mirrorPath(pathname) + search + hash;

// Where the /en and /ru commands land: the same place, in the language they name.
// Directed, unlike mirrorPath, which only knows how to flip — asking for the
// language already on screen has to be a no-op, not a trip to the other one.
export const pathForLang = (lang: Lang, path: string): string =>
  langFromPath(path) === lang ? path : mirrorPath(path);
