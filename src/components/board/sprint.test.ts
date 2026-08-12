// Pins the sprint's feel, which is the whole quest: a burst of clicks catches the
// group and a lazy one never does. Pure math on an injected clock — no timers here,
// so the numbers are the test rather than the wall clock.
import { describe, expect, it } from 'vitest';
import { EMPTY_SPRINT, PUSH_KMH, caught, coast, push } from './sprint';

describe('the sprint math', () => {
  it('push adds speed, coast decays it linearly', () => {
    let s = push(EMPTY_SPRINT, 1000); // 18 km/h at t=1000
    s = coast(s, 2000); // 1s later: 18-15 = 3
    expect(s.speed).toBeCloseTo(3);
  });

  it('speed never goes below zero', () =>
    expect(coast(push(EMPTY_SPRINT, 0), 60000).speed).toBe(0));

  it('a push from a standstill is worth exactly one push', () =>
    expect(push(EMPTY_SPRINT, 9000).speed).toBeCloseTo(PUSH_KMH));

  // Both sides of the line, or the target is free to drift: asserting only that a
  // long burst catches the group holds true for any target the burst overshoots.
  it('rapid pushes reach the target, and a click short of it does not', () => {
    const burst = (clicks: number) => {
      let s = EMPTY_SPRINT;
      for (let i = 0; i < clicks; i++) s = push(s, i * 250); // 4 clicks/s
      return s;
    };
    expect(caught(burst(6))).toBe(false); // 6x18 - 1.25s x 15 = 89.25, just short
    expect(caught(burst(7))).toBe(true); // 7x18 - 1.5s x 15 = 103.5 >= 100
  });

  it('lazy clicking never catches the group', () => {
    let s = EMPTY_SPRINT;
    for (let i = 0; i < 30; i++) s = push(s, i * 1500); // < decay rate net
    expect(caught(s)).toBe(false);
  });
});
