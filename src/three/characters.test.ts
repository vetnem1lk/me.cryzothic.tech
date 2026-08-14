// The registry doubles as the progress denominator and the head-swap map, so a
// silent edit here breaks loading UX and the visibility toggle at once — pin it.
import { describe, expect, it } from 'vitest';
import { CHARACTERS, characterById, progressPct } from './characters';

describe('character registry', () => {
  it('ships exactly the two closed models under the versioned path', () => {
    expect(CHARACTERS.map((c) => c.id)).toEqual(['m', 'f']);
    for (const c of CHARACTERS) {
      expect(c.glb).toMatch(/^\/g2\/v1\/scene_[mf]b_final\.glb$/);
    }
  });

  it('pins the byte denominators to the closed GLB pair', () => {
    expect(characterById('m').bytes).toBe(5_849_572);
    expect(characterById('f').bytes).toBe(5_907_552);
  });

  it('maps both head slots to real node names per character', () => {
    expect(characterById('m').heads).toEqual({ hair: 'MHair', mask: 'MMask' });
    expect(characterById('f').heads).toEqual({ hair: 'FHair', mask: 'Mask' });
  });

  it('throws on an unknown id instead of returning undefined', () => {
    expect(() => characterById('x' as never)).toThrow(/unknown character/);
  });
});

describe('progressPct', () => {
  it('reports whole percentages clamped to 0..100', () => {
    expect(progressPct(0, 100)).toBe(0);
    expect(progressPct(50, 200)).toBe(25);
    expect(progressPct(5_849_572, 5_849_572)).toBe(100);
    expect(progressPct(6_000_000, 5_849_572)).toBe(100);
  });

  it('never divides by a zero or missing denominator', () => {
    expect(progressPct(1024, 0)).toBe(0);
    expect(progressPct(1024, -1)).toBe(0);
  });

  it('floors instead of rounding so 100 means actually done', () => {
    expect(progressPct(999, 1000)).toBe(99);
  });
});
