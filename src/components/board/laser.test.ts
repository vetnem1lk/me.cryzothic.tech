// Pins the optics of the rocket quest: which of the sixteen mirror settings light it,
// the exact route the beam takes through a winning one, and that a blocked beam is
// still a drawable line. Pure geometry, so the coordinates are the test.
import { describe, expect, it } from 'vitest';
import { type Dir, solves, trace } from './laser';

describe('the laser geometry', () => {
  it('the exact solved-set: both mirrors "/" (dir%2===1), 4 of 16 states', () => {
    const solved: Dir[][] = [];
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++) if (solves(a as Dir, b as Dir)) solved.push([a as Dir, b as Dir]);
    expect(solved).toEqual([
      [1, 1],
      [1, 3],
      [3, 1],
      [3, 3],
    ]);
  });

  it('beam path: E from source, "/" turns it N at M1, "/" turns it E at M2, target', () => {
    const { path, hit } = trace(1, 1);
    expect(hit).toBe(true);
    expect(path).toEqual([
      { x: 10, y: 50 },
      { x: 50, y: 50 },
      { x: 50, y: 10 },
      { x: 90, y: 10 },
    ]);
  });

  it('blocked beam still returns a truncated path for rendering', () => {
    const { path, hit } = trace(0, 0); // '\' at M1 sends it S, off-grid
    expect(hit).toBe(false);
    expect(path[0]).toEqual({ x: 10, y: 50 });
    expect(path.length).toBeGreaterThanOrEqual(2); // beam is VISIBLY firing+blocked
  });

  // Every setting must end somewhere: the renderer draws a polyline off this and a
  // beam that never terminated would hang the frame instead of missing the rocket.
  it('every one of the sixteen settings terminates on a drawable path', () => {
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++) {
        const { path, hit } = trace(a as Dir, b as Dir);
        expect(path[0]).toEqual({ x: 10, y: 50 });
        expect(path.length).toBeGreaterThanOrEqual(2);
        expect(hit).toBe(a % 2 === 1 && b % 2 === 1);
      }
  });
});
