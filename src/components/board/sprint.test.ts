// Pins the sprint's feel, which is the whole quest: a burst of clicks catches the
// group and a lazy one never does. Pure math on an injected clock — no timers here,
// so the numbers are the test rather than the wall clock.
import { describe, expect, it } from 'vitest';
import { EMPTY_SPRINT, PUSH_KMH, caught, coast, push } from './sprint';

describe('the sprint math', () => {
  it('push adds speed, coast decays it linearly', () => {
    let s = push(EMPTY_SPRINT, 1000); // 7 km/h at t=1000
    s = coast(s, 2000); // 1s later: 7-6 = 1
    expect(s.speed).toBeCloseTo(1);
  });

  it('speed never goes below zero', () =>
    expect(coast(push(EMPTY_SPRINT, 0), 60000).speed).toBe(0));

  it('a push from a standstill is worth exactly one push', () =>
    expect(push(EMPTY_SPRINT, 9000).speed).toBeCloseTo(PUSH_KMH));

  it('rapid pushes reach the target', () => {
    let s = EMPTY_SPRINT;
    for (let i = 0; i < 8; i++) s = push(s, i * 250); // 4 clicks/s
    expect(caught(s)).toBe(true); // 8x7 - 1.75s x 6 = 45.5 >= 40
  });

  it('lazy clicking never catches the group', () => {
    let s = EMPTY_SPRINT;
    for (let i = 0; i < 30; i++) s = push(s, i * 1500); // < decay rate net
    expect(caught(s)).toBe(false);
  });
});
