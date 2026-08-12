// Pins the terminal's submit queue — the ordering VaiShell claims out loud beside
// its promise ref. Answers land in the order the questions were asked even when
// the answers themselves finish out of order, a turn that throws does not take the
// queue down with it, and its error still reaches the caller: that is where the
// shell writes its `[sys] transport error` line, and a chain that swallowed it
// would print nothing at all.
import { describe, expect, test } from 'vitest';
import { chain } from './queue';

describe('chain', () => {
  test('side effects run in submit order, however the answers resolve', async () => {
    const order: string[] = [];
    let release = () => {};
    const held = new Promise<void>((r) => {
      release = r;
    });

    // Deliberately inverted: the first turn waits on a promise nothing has
    // settled yet, the second's work is a single push. Left to themselves the
    // second would land first — the chain is the only thing saying otherwise.
    let q = chain(Promise.resolve(), async () => {
      await held;
      order.push('first');
    });
    q = chain(q, async () => {
      order.push('second');
    });
    release();

    await q;
    expect(order).toEqual(['first', 'second']);
  });

  test('a turn that throws does not stop the next one', async () => {
    const order: string[] = [];
    const failed = chain(Promise.resolve(), async () => {
      order.push('boom');
      throw new Error('boom');
    });
    // The shell's own `.catch` — the sys line lives there, not in the chain.
    const handled = failed.catch(() => order.push('sys'));

    await chain(failed, async () => {
      order.push('next');
    });
    await handled;
    expect(order).toEqual(['boom', 'sys', 'next']);
  });

  test("a turn's own error reaches the caller, which is what prints it", async () => {
    await expect(
      chain(Promise.resolve(), () => Promise.reject(new Error('transport'))),
    ).rejects.toThrow('transport');
  });

  test('a predecessor left rejected still lets the next turn run', async () => {
    // The shell always hands over a caught tail, so this cannot happen there —
    // which is exactly why it is pinned here: the chain is what makes that safe
    // to forget rather than a rule the call site has to keep remembering.
    let ran = false;
    await chain(Promise.reject(new Error('unhandled')), async () => {
      ran = true;
    });
    expect(ran).toBe(true);
  });
});
