// One wheel of the /nda code lock: the digit a press lands on, either way round.
//
// The `+ 10` is what makes the down-press legal: a remainder in JavaScript keeps the
// sign of what it is taken of, so `-1 % 10` is `-1` and the wheel would show a minus.
export const step = (digit: number, delta: 1 | -1): number => (digit + delta + 10) % 10;
