// The momentum behind the /nda sprint: every click is a pedal push, and the speed
// bleeds away between them, so catching the group takes a burst rather than a
// patient tap. Pure arithmetic on an injected clock — no timers, no state of its
// own — which is what lets the card animate the digit however it likes and the
// tests read the feel straight off the numbers.
export interface SprintState {
  speed: number;
  at: number;
}

/** A standstill. `at: 0` never matters: the first push coasts from zero to zero. */
export const EMPTY_SPRINT: SprintState = { speed: 0, at: 0 };

export const SPRINT_TARGET = 100; // km/h — catch the group
export const PUSH_KMH = 18; // each pedal push
export const DECAY_KMH_S = 15; // linear coast-down per second
// Tuned forgiving on mobile: 18 up against 15 down means ~6-9 quick clicks catch the
// group, while a click every second and a half never gains on it.

/** Where the speed has drifted to by `nowMs` — the only place time enters. */
export function coast(s: SprintState, nowMs: number): SprintState {
  const dt = Math.max(0, nowMs - s.at) / 1000;
  return { speed: Math.max(0, s.speed - DECAY_KMH_S * dt), at: nowMs };
}

export function push(s: SprintState, nowMs: number): SprintState {
  const c = coast(s, nowMs);
  return { speed: c.speed + PUSH_KMH, at: nowMs };
}

export const caught = (s: SprintState): boolean => s.speed >= SPRINT_TARGET;
