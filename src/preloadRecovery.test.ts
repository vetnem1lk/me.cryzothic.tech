import { describe, expect, test, vi } from 'vitest';
import { makePreloadHandler } from './preloadRecovery';

// One test on purpose: `reloaded` is module state, so a second one would need
// vi.resetModules() plus a dynamic re-import to start from a fresh flag.
describe('preload recovery', () => {
  test('cancels every event, reloads once', () => {
    const reload = vi.fn();
    const handler = makePreloadHandler(reload);
    // Vite dispatches a fresh event per failed dep, plus one for the module itself.
    const first = new Event('vite:preloadError', { cancelable: true });
    const second = new Event('vite:preloadError', { cancelable: true });
    handler(first);
    handler(second);

    expect(reload).toHaveBeenCalledTimes(1);
    // Vite rethrows unless the handler cancels: `if (!e.defaultPrevented) throw err`.
    // The second must be cancelled too, or its error escapes mid-reload.
    expect(first.defaultPrevented).toBe(true);
    expect(second.defaultPrevented).toBe(true);
  });
});
