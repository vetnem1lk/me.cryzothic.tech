// The one branch guarding the GL teardown. Pinned pure, without a context: if
// dispose() ever runs while compileAsync is still polling, three reads renderer
// properties it has just wiped and throws from inside its own timer — an
// uncaught error the viewer can neither see nor catch.
import { describe, expect, it } from 'vitest';
import { afterPending } from './createViewer';

describe('afterPending', () => {
  it('tears down synchronously when no compile is in flight', () => {
    let torn = 0;
    afterPending(null, () => (torn += 1));
    expect(torn).toBe(1);
  });

  it('waits for a compile in flight instead of tearing down under it', async () => {
    let torn = 0;
    let settle = () => {};
    afterPending(
      new Promise<void>((resolve) => (settle = resolve)),
      () => (torn += 1),
    );
    expect(torn).toBe(0);
    settle();
    await Promise.resolve();
    await Promise.resolve();
    expect(torn).toBe(1);
  });

  it('still tears down when the compile rejects — a failed one owns a context too', async () => {
    let torn = 0;
    afterPending(Promise.reject(new Error('context lost')), () => (torn += 1));
    await Promise.resolve();
    await Promise.resolve();
    expect(torn).toBe(1);
  });
});
