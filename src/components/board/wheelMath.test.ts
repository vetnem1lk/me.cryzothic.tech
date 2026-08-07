// Pins the pure wheel math: how a device's raw delta becomes pixels, and how
// pixels become the next scrollLeft — looping track always consumes and wraps
// backward; static (reduced-motion) track consumes only when it can move.
import { describe, expect, it } from 'vitest';
import { wheelPx, wheelStep } from './wheelMath';

describe('wheelPx', () => {
  it('passes pixel deltas through and sums both axes', () => {
    expect(wheelPx({ deltaX: 10, deltaY: 30, deltaMode: 0 }, 400)).toBe(40);
  });
  it('scales line deltas, as Firefox mouse wheels report them', () => {
    expect(wheelPx({ deltaX: 0, deltaY: 3, deltaMode: 1 }, 400)).toBe(48);
  });
  it('scales page deltas by the visible width', () => {
    expect(wheelPx({ deltaX: 0, deltaY: -1, deltaMode: 2 }, 400)).toBe(-400);
  });
});

describe('wheelStep', () => {
  it('maps a positive delta forward on the looping track', () => {
    expect(wheelStep(100, 40, 500, Infinity)).toBe(140);
  });
  it('wraps a negative delta past zero by one period', () => {
    expect(wheelStep(10, -40, 500, Infinity)).toBe(470);
    expect(wheelStep(10, -1100, 500, Infinity)).toBe(410); // a fling wraps repeatedly
  });
  it('ignores a zero delta', () => {
    expect(wheelStep(100, 0, 500, Infinity)).toBeNull();
  });
  it('clamps on the static track and reports movement', () => {
    expect(wheelStep(0, 40, 0, 120)).toBe(40);
    expect(wheelStep(100, 40, 0, 120)).toBe(120);
  });
  it('refuses the event when the static track cannot move', () => {
    expect(wheelStep(0, -40, 0, 120)).toBeNull(); // at left edge
    expect(wheelStep(120, 40, 0, 120)).toBeNull(); // at right edge
  });
});
