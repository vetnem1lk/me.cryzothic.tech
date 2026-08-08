// Post-deploy self-heal. A tab left open across a redeploy still holds the old
// manifest, so its lazy chunks 404 into the SPA fallback — HTML served with a JS
// MIME type — and Vite fires `vite:preloadError` on the window. One reload fetches
// the current manifest. The flag is a module variable, not storage: this site keeps
// no cookies and no storage.
// ponytail: the flag dies with the page, so stale HTML (served without
// `Cache-Control: no-cache`) can still loop the reload — that fix is server-side.
let reloaded = false;

export const makePreloadHandler = (reload: () => void) => (e: Event) => {
  // Vite mints a fresh cancelable event per failed dependency and rethrows any it gets
  // back uncancelled, so cancel every one; only the reload is one-shot.
  e.preventDefault();
  if (reloaded) return;
  reloaded = true;
  reload();
};

export const installPreloadRecovery = () =>
  window.addEventListener('vite:preloadError', makePreloadHandler(() => window.location.reload()));
