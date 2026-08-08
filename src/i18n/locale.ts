// Pure URL<->language helpers. The URL is the single source of truth for the
// site language: /ru/* is Russian, everything else is English. No storage.
export type Lang = 'en' | 'ru';

// Segment-aware on purpose: '/rules' must stay EN even though it starts with 'ru'.
export const langFromPath = (path: string): Lang =>
  path === '/ru' || path.startsWith('/ru/') ? 'ru' : 'en';

export const pickInitialLocale = (navLang: string | undefined): Lang =>
  navLang?.toLowerCase().startsWith('ru') ? 'ru' : 'en';

// '/career' <-> '/ru/career'; roots map to roots.
export const mirrorPath = (path: string): string => {
  if (langFromPath(path) === 'ru') return path.slice(3) || '/';
  return path === '/' ? '/ru' : `/ru${path}`;
};
