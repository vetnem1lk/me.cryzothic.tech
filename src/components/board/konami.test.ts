// Pins the two halves of the old cheat code: a buffer that only ever counts forward
// on the right step, and a swipe reader for the visitors who have no arrow keys. Pure
// arithmetic, so the whole sequence is walked here rather than pressed at a keyboard.
import { describe, expect, it } from 'vitest';
import { KONAMI, advance, swipeDir } from './konami';

describe('the sequence buffer', () => {
  it('counts the whole sequence through to its end', () => {
    let pos = 0;
    for (const step of KONAMI) pos = advance(pos, step);
    expect(pos).toBe(KONAMI.length);
  });

  it('drops back to nothing on a wrong step', () => expect(advance(2, 'right')).toBe(0));

  // The case a plain reset gets wrong: the step that broke the run is also the step
  // that opens one, so the visitor is already one in rather than back at nothing.
  it('starts over when the wrong step is the opening one', () =>
    expect(advance(3, 'up')).toBe(1));
});

describe('reading a swipe', () => {
  it('names the way the finger went', () => {
    expect(swipeDir(0, -40)).toBe('up');
    expect(swipeDir(0, 40)).toBe('down');
    expect(swipeDir(50, 10)).toBe('right');
    expect(swipeDir(-50, 10)).toBe('left');
  });

  it('ignores a touch that barely moved', () => expect(swipeDir(10, 10)).toBeNull());

  it('takes the axis the finger travelled furthest along', () =>
    expect(swipeDir(40, -90)).toBe('up'));
});
