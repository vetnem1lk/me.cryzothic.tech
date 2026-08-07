// Pins the pacing math behind the terminal's typing: how fast text lands, when
// it speeds up to catch a stream running ahead of it, and that not a single
// character is lost, duplicated or reordered on the way to the screen.
import { describe, expect, test } from 'vitest';
import { EMPTY, push, take, type DrainState } from './drain';

/** A state holding `n` characters, none of them painted yet. */
const filled = (n: number, over: Partial<DrainState> = {}): DrainState => ({
  ...EMPTY,
  buf: 'x'.repeat(n),
  ...over,
});

const FRAME = 16; // one 60 Hz frame, the interval a paint loop reports

describe('push', () => {
  test('appends without disturbing what is already on screen', () => {
    const s = push(push(EMPTY, 'ab'), 'cd');
    expect(s.buf).toBe('abcd');
    expect(s.shown).toBe(0);
    expect(s.doneFeeding).toBe(false);
  });

  test('leaves the source state untouched', () => {
    const before = filled(3);
    push(before, 'more');
    expect(before.buf).toBe('xxx');
  });
});

describe('take pacing', () => {
  test('one second of typing lands at most 70 characters', () => {
    const [chunk] = take(filled(200), 1000);
    expect(chunk).toHaveLength(70);
  });

  test('a backlog over 240 characters switches to catch-up speed', () => {
    const [chunk] = take(filled(300), 1000);
    expect(chunk).toHaveLength(280); // 70 cps x 4
  });

  test('an ended stream drains at catch-up speed however short the tail', () => {
    const [chunk, next] = take(filled(100, { doneFeeding: true }), 1000);
    expect(chunk).toHaveLength(100);
    expect(next.shown).toBe(100);
  });

  test('the fraction of a character earned per frame is carried, not lost', () => {
    // 70 cps x 16 ms = 1.12 characters a frame: floor() alone would type one
    // per frame forever and silently run ~10% slow.
    let s: DrainState = filled(50);
    let typed = '';
    for (let i = 0; i < 9; i++) {
      const [chunk, next] = take(s, FRAME);
      typed += chunk;
      s = next;
    }
    expect(typed).toHaveLength(10);
  });

  test('a frame too short for a whole character paints nothing but keeps the credit', () => {
    const [chunk, next] = take(filled(50), 5);
    expect(chunk).toBe('');
    expect(next.shown).toBe(0);
    expect(next.carry).toBeCloseTo(0.35);
  });

  test('credit for characters that never arrived is dropped, not banked', () => {
    // A long idle gap on a drained buffer must not buy an instant burst when
    // the stream wakes up again.
    const [, drained] = take(filled(5), 1000);
    const [chunk] = take(push(drained, 'y'.repeat(100)), 0);
    expect(drained.shown).toBe(5);
    expect(chunk).toBe('');
  });

  test('nothing to type leaves the state alone', () => {
    const idle = filled(4, { shown: 4 });
    const [chunk, next] = take(idle, 1000);
    expect(chunk).toBe('');
    expect(next).toBe(idle);
  });
});

describe('take flush', () => {
  test('Infinity hands over the whole remainder at once', () => {
    const [chunk, next] = take(filled(1000, { shown: 400 }), Infinity);
    expect(chunk).toHaveLength(600);
    expect(next.shown).toBe(1000);
    expect(next.carry).toBe(0);
  });

  test('Infinity on an empty buffer is a no-op', () => {
    const [chunk, next] = take(EMPTY, Infinity);
    expect(chunk).toBe('');
    expect(next.shown).toBe(0);
  });
});

describe('take invariants', () => {
  test('an interleaved stream reaches the screen whole and in order', () => {
    const tokens = ['Hello', ' there', ', this ', 'is a ', 'longer '.repeat(40), 'end.'];
    let s: DrainState = EMPTY;
    let typed = '';
    let shown = 0;

    for (const tok of tokens) {
      s = push(s, tok);
      for (let i = 0; i < 5; i++) {
        const [chunk, next] = take(s, FRAME);
        typed += chunk;
        s = next;
        expect(s.shown).toBeGreaterThanOrEqual(shown); // never rewinds
        shown = s.shown;
      }
    }
    s = { ...s, doneFeeding: true };
    const [tail, done] = take(s, Infinity);
    typed += tail;

    expect(typed).toBe(tokens.join(''));
    expect(done.shown).toBe(done.buf.length);
  });
});
