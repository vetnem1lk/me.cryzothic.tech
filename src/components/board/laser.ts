// The rocket quest, and the one piece of /nda that is real geometry rather than a
// counter: a beam leaves the source heading east, takes 90° turns off two mirrors the
// visitor rotates, and either reaches the rocket or runs off the square. Pure math and
// zero dependencies — no SVG, no React, no clock — so the renderer draws whatever this
// hands back and the tests read the optics straight off the coordinates. It is the
// gameplay-proof exhibit: the piece a reader opens to see that the puzzle is a puzzle.

/** A mirror's rotation in 90° steps. Only the parity is optical: 0/2 = `\`, 1/3 = `/`. */
export type Dir = 0 | 1 | 2 | 3;

export interface Point {
  x: number;
  y: number;
}

/** The square the beam lives in — viewBox "0 0 100 100", so a miss exits at 0 or 100. */
export const VIEW = 100;
export const SOURCE: Point = { x: 10, y: 50 };
export const MIRRORS: Point[] = [
  { x: 50, y: 50 },
  { x: 50, y: 10 },
];
export const TARGET: Point = { x: 90, y: 10 };

// Screen axes, so north is y going down-to-up: -y.
type Heading = 'N' | 'E' | 'S' | 'W';
const STEP: Record<Heading, Point> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

// The whole of the optics, spelled out per face rather than derived: four turns each,
// and each one is its own line to break.
const BOUNCE: Record<'\\' | '/', Record<Heading, Heading>> = {
  '/': { E: 'N', N: 'E', W: 'S', S: 'W' },
  '\\': { E: 'S', S: 'E', W: 'N', N: 'W' },
};

/**
 * How far ahead `p` sits on the ray from `at`, or Infinity when it is not on it at all.
 * Strictly ahead: the mirror the beam is leaving is at 0 and must not catch it again.
 */
function reach(at: Point, step: Point, p: Point): number {
  const t = step.x ? (p.x - at.x) / step.x : (p.y - at.y) / step.y;
  const aligned = step.x ? p.y === at.y : p.x === at.x;
  return aligned && t > 0 ? t : Infinity;
}

/** Where the beam leaves the square, given nothing is left in its way. */
const wall = (at: Point, step: Point): Point => ({
  x: step.x > 0 ? VIEW : step.x < 0 ? 0 : at.x,
  y: step.y > 0 ? VIEW : step.y < 0 ? 0 : at.y,
});

/**
 * The beam for one mirror setting: the vertices to draw, source first, and whether the
 * last one is the rocket. A blocked beam still comes back as a line — the visitor has
 * to see it fire and stop somewhere, or the mirrors look broken rather than wrong.
 */
export function trace(m1: Dir, m2: Dir): { path: Point[]; hit: boolean } {
  const faces = [m1, m2].map((d) => (d % 2 ? '/' : '\\') as '\\' | '/');
  const stops = [...MIRRORS, TARGET]; // the rocket sits last, so its index is the hit
  const path: Point[] = [SOURCE];
  let at = SOURCE;
  let heading: Heading = 'E';
  // Two mirrors can turn the beam twice; the bound is a guard, not a rule — this
  // layout has no cycle in it, and a renderer must not be handed an endless polyline.
  for (let bounces = 0; bounces <= MIRRORS.length; bounces++) {
    // Annotated, not inferred: `heading` is reassigned at the bottom of the loop, and
    // without this tsc chases the back edge round in a circle and gives up on the type.
    const step: Point = STEP[heading];
    const ts = stops.map((p) => reach(at, step, p));
    const nearest = Math.min(...ts);
    if (nearest === Infinity) break;
    const i = ts.indexOf(nearest);
    at = stops[i];
    path.push(at);
    if (i === MIRRORS.length) return { path, hit: true };
    heading = BOUNCE[faces[i]][heading];
  }
  path.push(wall(at, STEP[heading]));
  return { path, hit: false };
}

/** The four settings of sixteen that light the rocket. */
export const solves = (m1: Dir, m2: Dir): boolean => trace(m1, m2).hit;
