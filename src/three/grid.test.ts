// The floor labels are laid out by hand from two constants, and the fix that made
// them legible stretched every quad about five times along Z. Nothing at runtime
// complains when two of them land on top of each other or straddle the very axis
// they annotate — it just renders mush, which is the defect this replaced. Pinned
// pure: no GL context, no canvas, just the rectangles.
import { describe, expect, it } from 'vitest';
import { GLYPH_D, GLYPH_W, layoutGlyphs } from './grid';

const boxes = () =>
  layoutGlyphs().map((g) => ({
    char: g.char,
    x0: g.x - GLYPH_W / 2,
    x1: g.x + GLYPH_W / 2,
    z0: g.z - GLYPH_D / 2,
    z1: g.z + GLYPH_D / 2,
  }));

describe('grid label layout', () => {
  it('never overlaps two glyph quads', () => {
    const all = boxes();
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        const a = all[i];
        const b = all[j];
        // EPS, because neighbours inside one label are exactly one advance apart
        // and float addition lands them a rounding error inside each other.
        const EPS = 1e-6;
        const hit =
          a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS && a.z0 < b.z1 - EPS && b.z0 < a.z1 - EPS;
        expect(hit, `${a.char}@${a.x0.toFixed(3)} vs ${b.char}@${b.x0.toFixed(3)}`).toBe(false);
      }
    }
  });

  it('keeps every quad clear of both axis lines', () => {
    for (const b of boxes()) {
      // x = 0 is the Z axis, z = 0 is the X axis; a quad crossing either sits on
      // top of the line it is supposed to label.
      expect(b.x0, `${b.char} crosses the Z axis`).toBeGreaterThan(0);
      expect(b.z0 > 0 || b.z1 < 0, `${b.char} crosses the X axis`).toBe(true);
    }
  });
});
