// Pins the optics of the rocket quest: which of the sixteen mirror settings light it,
// the exact route the beam takes through a winning one, that a blocked beam is still
// a drawable line, and which wall it runs off. Pure geometry, so the coordinates are
// the test.
import { describe, expect, it } from 'vitest';
import { type Dir, blockedEdge, solves, trace } from './laser';

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

  // A miss is not one thing: the panel says which way the beam went, so the wall it
  // ran off is read straight off the last vertex and named.
  it('a beam on the rocket ran off nothing', () => {
    const t = trace(1, 1);
    expect(t.hit).toBe(true);
    expect(blockedEdge(t)).toBeNull();
  });

  it('a blocked beam names the wall it left by', () => {
    expect(blockedEdge(trace(0, 0))).toBe('bottom'); // straight down into the floor
    expect(blockedEdge(trace(1, 0))).toBe('left'); // turned once, then out the near side
  });

  it('every one of the sixteen settings lands on exactly one of the three answers', () => {
    for (let a = 0; a < 4; a++)
      for (let b = 0; b < 4; b++) {
        const t = trace(a as Dir, b as Dir);
        const edge = blockedEdge(t);
        expect(t.hit ? edge === null : edge === 'bottom' || edge === 'left').toBe(true);
      }
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
