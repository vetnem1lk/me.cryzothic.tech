// The old cheat code, and a swipe reader so a phone can enter it too. Pure arithmetic
// on a single buffer position — no keys, no listeners, no state of its own — so the
// component that hears the input owns where the visitor has got to.

export type Dir8 = 'up' | 'down' | 'left' | 'right';

/** Six steps of the thirty-year-old one. The rest of it was never the interesting part. */
export const KONAMI: readonly Dir8[] = ['up', 'up', 'down', 'down', 'left', 'right'];

/**
 * Where the buffer stands after one step. A wrong step drops the run — except when it
 * is the opening step itself, which starts a new one rather than nothing.
 */
export function advance(pos: number, step: Dir8): number {
  if (step === KONAMI[pos]) return pos + 1;
  return step === KONAMI[0] ? 1 : 0;
}

/**
 * A drag turned into one of the four directions: the axis it went furthest along wins,
 * and anything shorter than the threshold is a tap that wandered, not a swipe.
 */
export function swipeDir(dx: number, dy: number, threshold = 30): Dir8 | null {
  const vertical = Math.abs(dy) >= Math.abs(dx);
  const d = vertical ? dy : dx;
  if (Math.abs(d) < threshold) return null;
  return vertical ? (d > 0 ? 'down' : 'up') : (d > 0 ? 'right' : 'left');
}
