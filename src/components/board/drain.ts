// Paced typing for the terminal. Tokens arrive from the network in bursts; this
// hands them to the screen at a steady reading speed instead. Pure math — no
// DOM, no timers: the caller says how long the last frame took and gets back the
// text to paint plus the state to keep.

/** Characters per second at rest — a brisk, readable typing speed. */
const BASE_CPS = 70;
/** Speed multiplier once the typing is behind the stream. */
const CATCH_UP = 4;
/** Unpainted characters (about two lines) that count as behind. */
const BACKLOG = 240;

export interface DrainState {
  /** Every character received so far. */
  buf: string;
  /** How many of them are already on screen. */
  shown: number;
  /** True once the stream ended: nothing more will be pushed. */
  doneFeeding: boolean;
  /** Fraction of a character earned but not yet spent — see `take`. */
  carry: number;
}

export const EMPTY: DrainState = { buf: '', shown: 0, doneFeeding: false, carry: 0 };

/** Records a freshly arrived token. Nothing is ever removed from `buf`. */
export const push = (s: DrainState, tok: string): DrainState => ({ ...s, buf: s.buf + tok });

/**
 * The text to paint after `elapsedMs` of wall clock, with the state that goes
 * with it. `Infinity` hands over the whole remainder at once — the
 * reduced-motion path, where paced typing is the animation to skip.
 */
export function take(s: DrainState, elapsedMs: number): [string, DrainState] {
  const pending = s.buf.length - s.shown;
  if (pending <= 0) return ['', s];

  // Two lines behind, or the answer is already complete: quadruple speed so the
  // typing never trails the stream by seconds.
  const cps = pending > BACKLOG || s.doneFeeding ? BASE_CPS * CATCH_UP : BASE_CPS;
  // One 16 ms frame at 70 cps earns 1.12 characters. Without carrying the .12
  // the floor below would throw it away every frame and type ~10% slow.
  const budget = s.carry + (cps * Math.max(0, elapsedMs)) / 1000;
  const want = Math.floor(budget);
  if (want < 1) return ['', { ...s, carry: budget }];

  const n = Math.min(want, pending);
  return [
    s.buf.slice(s.shown, s.shown + n),
    // Credit for characters that have not arrived is dropped rather than banked:
    // an idle gap must not buy a burst of typing once tokens resume.
    { ...s, shown: s.shown + n, carry: n < want ? 0 : budget - n },
  ];
}
