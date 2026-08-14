// The blink profile and its period are the whole auto-blink feature — the rest
// is one branch on the render loop. Pinned pure, so the eyelid math is checked
// without a GL context: a ramp that never reaches 1 is a twitch, one that never
// returns to 0 leaves the character staring through closed lids.
import { describe, expect, it } from 'vitest';
import { blinkValue, nextBlinkDelay } from './createViewer';

describe('blinkValue', () => {
  it('shuts the lid fully at mid-blink and opens it again by the end', () => {
    expect(blinkValue(0.09)).toBe(1);
    expect(blinkValue(0.045)).toBeCloseTo(0.5, 5);
    expect(blinkValue(0.135)).toBeCloseTo(0.5, 5);
  });

  it('reads eyes-open outside the ~180 ms window, both sides', () => {
    expect(blinkValue(0)).toBe(0);
    expect(blinkValue(-1)).toBe(0);
    expect(blinkValue(0.18)).toBe(0);
    expect(blinkValue(5)).toBe(0);
  });

  it('never leaves the influence outside 0..1', () => {
    for (let t = -0.05; t < 0.25; t += 0.005) {
      const v = blinkValue(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('nextBlinkDelay', () => {
  it('maps the whole random range onto the spec 2–6 s period', () => {
    expect(nextBlinkDelay(0)).toBe(2);
    expect(nextBlinkDelay(0.5)).toBe(4);
    // Math.random() is exclusive at the top, so 6 s is a limit, never a value.
    expect(nextBlinkDelay(0.999999)).toBeLessThan(6);
    expect(nextBlinkDelay(0.999999)).toBeGreaterThan(5.99);
  });
});
