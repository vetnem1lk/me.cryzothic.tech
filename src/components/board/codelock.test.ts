// Pins the only thing a wheel of the lock has to get right: 0 through 9 and back
// round, both ways. An off-by-one here is a wheel that jams at an end or shows a
// tenth digit — and the cover has no other arithmetic in it at all.
import { describe, expect, it } from 'vitest';
import { step } from './codelock';

describe('step', () => {
  it('rolls past nine to zero', () => {
    expect(step(9, 1)).toBe(0);
  });
  it('rolls below zero to nine', () => {
    expect(step(0, -1)).toBe(9);
  });
  it('counts up inside the range', () => {
    expect(step(4, 1)).toBe(5);
  });
});
