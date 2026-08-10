// Pins the story's rules: which quest opens which chapter, that a chapter answers
// only to the quest guarding it — the designated file above all — and that every
// unlock reaches the /lore reader exactly once.
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { markCvDownloaded, resetCvFlag } from './cvFlag';
import * as story from './story';

const { CHAPTERS, DECLASSIFY_CHAPTER, QUESTS } = story;

/** The chapter a given quest guards — the tests name quests, never file numbers. */
const guarding = (q: story.Quest) => CHAPTERS.find((c) => QUESTS[c] === q) as story.ChapterId;
const KNOCK = guarding('knock');
const GUESS = guarding('guess');
const SPRINT = guarding('sprint');
const DIALOG = guarding('dialog');
const CV = guarding('cv');
const others = (id: story.ChapterId) => CHAPTERS.filter((c) => c !== id);

beforeEach(() => {
  story.resetStory();
  resetCvFlag();
});

describe('the quest table', () => {
  // Seven chapters, seven quests, no two alike: the placeholder slots are gone and
  // every cover now has a puzzle of its own behind it.
  test('is seven chapters, one quest each', () => {
    const count = (q: story.Quest) => CHAPTERS.filter((c) => QUESTS[c] === q).length;
    expect(CHAPTERS).toHaveLength(7);
    const quests: story.Quest[] = //
      ['knock', 'guess', 'cv', 'declassify', 'sprint', 'dialog', 'laser'];
    expect(quests.map(count)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    // The three newcomers sit on the photos that tell their joke: the mass start,
    // the conference badge, the rocket.
    expect(QUESTS['FILE-04']).toBe('sprint');
    expect(QUESTS['FILE-05']).toBe('dialog');
    expect(QUESTS['FILE-07']).toBe('laser');
    expect(QUESTS[DECLASSIFY_CHAPTER]).toBe('declassify');
    expect(DECLASSIFY_CHAPTER).toBe('FILE-02'); // the hall photo carries the "VAI can help" hint
  });
});

describe('knock', () => {
  test('unlocks on the 3rd knock, once', () => {
    expect(story.knock(KNOCK)).toBe(false);
    expect(story.knockCount(KNOCK)).toBe(1);
    expect(story.knock(KNOCK)).toBe(false);
    expect(story.knock(KNOCK)).toBe(true);
    expect(story.isUnlocked(KNOCK)).toBe(true);
    expect(story.knock(KNOCK)).toBe(false); // no re-unlock
    expect(story.knockCount(KNOCK)).toBe(3);
  });

  test('leaves every chapter another quest guards alone', () => {
    for (const id of others(KNOCK)) {
      expect(story.knock(id) || story.knock(id) || story.knock(id)).toBe(false);
      expect(story.isUnlocked(id)).toBe(false);
      expect(story.knockCount(id)).toBe(0);
    }
  });
});

describe('guess', () => {
  test('any number is the right number — and only the first one counts', () => {
    expect(story.guess(GUESS)).toBe(true);
    expect(story.isUnlocked(GUESS)).toBe(true);
    expect(story.guess(GUESS)).toBe(false);
  });

  test('leaves every chapter another quest guards alone', () => {
    for (const id of others(GUESS)) expect(story.guess(id)).toBe(false);
    expect(others(GUESS).some(story.isUnlocked)).toBe(false);
  });
});

// Time is an argument here, never the wall clock: a burst of pushes is four a second
// and a lazy one is one every second and a half, both spelled out in milliseconds.
describe('sprint', () => {
  const burst = (id: story.ChapterId) => {
    let opened = false;
    for (let i = 0; i < 8; i++) opened = story.sprintPush(id, i * 250) || opened;
    return opened;
  };

  test('a burst catches the group and opens the file, once', () => {
    expect(story.sprintPush(SPRINT, 0)).toBe(false); // one push is not a sprint
    expect(burst(SPRINT)).toBe(true);
    expect(story.isUnlocked(SPRINT)).toBe(true);
    expect(story.takeLoreChapter()).toBe(SPRINT); // came through the one door, like the rest
    expect(story.sprintPush(SPRINT, 9000)).toBe(false); // no re-unlock
  });

  test('a lazy click never gains on the group', () => {
    for (let i = 0; i < 30; i++) expect(story.sprintPush(SPRINT, i * 1500)).toBe(false);
    expect(story.isUnlocked(SPRINT)).toBe(false);
  });

  // The card reads the speed on every frame it draws, and a read that decays the
  // stored state would spend the visitor's pushes on rendering them.
  test('reading the speed is free: it never spends what was pushed', () => {
    story.sprintPush(SPRINT, 1000);
    expect(story.sprintSpeed(SPRINT, 1000)).toBeCloseTo(7);
    expect(story.sprintSpeed(SPRINT, 2000)).toBeCloseTo(1); // a second of coasting
    expect(story.sprintSpeed(SPRINT, 2000)).toBeCloseTo(1); // and asking twice costs nothing
    story.sprintPush(SPRINT, 2000);
    expect(story.sprintSpeed(SPRINT, 2000)).toBeCloseTo(8); // 1 + one push, decayed once
  });

  test('leaves every chapter another quest guards alone', () => {
    for (const id of others(SPRINT)) {
      expect(burst(id)).toBe(false);
      expect(story.sprintSpeed(id, 2000)).toBe(0);
    }
    expect(others(SPRINT).some(story.isUnlocked)).toBe(false);
  });
});

// The guard on the door of the conference hall: he asks, any answer works, and the
// way through opens on the next press — but only after something has been said.
describe('the dialogue check', () => {
  test('a choice moves the scene to its outcome, and then the way opens once', () => {
    expect(story.dialogState(DIALOG).phase).toBe('ask');
    story.dialogChoose(DIALOG, 2);
    expect(story.dialogState(DIALOG)).toEqual({ phase: 'outcome', choice: 2 });
    expect(story.dialogOpen(DIALOG)).toBe(true);
    expect(story.dialogOpen(DIALOG)).toBe(false);
  });

  test('nobody walks past the guard without saying a word', () => {
    expect(story.dialogOpen(DIALOG)).toBe(false);
    expect(story.isUnlocked(DIALOG)).toBe(false);
  });

  test('what was said stands — the second answer is not an answer', () => {
    story.dialogChoose(DIALOG, 0);
    story.dialogChoose(DIALOG, 1);
    expect(story.dialogState(DIALOG)).toEqual({ phase: 'outcome', choice: 0 });
  });

  test('leaves every chapter another quest guards alone', () => {
    for (const id of others(DIALOG)) {
      story.dialogChoose(id, 1);
      expect(story.dialogState(id).phase).toBe('ask');
      expect(story.dialogOpen(id)).toBe(false);
    }
    expect(others(DIALOG).some(story.isUnlocked)).toBe(false);
  });
});

describe('declassify', () => {
  // Both cases get their own positive probe: an unlock is one-shot, so a second call
  // in the same test can only ever return null — which proves nothing about parsing.
  test('opens the one designated file from the code as the tile prints it', () => {
    expect(story.declassify(`declassify ${DECLASSIFY_CHAPTER}`)).toBe(DECLASSIFY_CHAPTER);
    expect(story.isUnlocked(DECLASSIFY_CHAPTER)).toBe(true);
    expect(story.declassify(`declassify ${DECLASSIFY_CHAPTER}`)).toBeNull(); // already open
  });

  test('opens it from the code as a hurried visitor types it', () => {
    expect(story.declassify(`declassify ${DECLASSIFY_CHAPTER.toLowerCase()}`)) //
      .toBe(DECLASSIFY_CHAPTER);
  });

  test('refuses every other code — valid ones included', () => {
    for (const id of others(DECLASSIFY_CHAPTER)) {
      expect(story.declassify(`declassify ${id}`)).toBeNull();
      expect(story.isUnlocked(id)).toBe(false);
    }
    expect(story.declassify('declassify FILE-99')).toBeNull();
    expect(story.declassify('declassify')).toBeNull();
  });
});

describe('the lore queue', () => {
  test('yields freshly unlocked chapters FIFO, each exactly once', () => {
    story.knock(KNOCK);
    story.knock(KNOCK);
    story.knock(KNOCK);
    story.guess(GUESS);
    expect(story.takeLoreChapter()).toBe(KNOCK);
    expect(story.takeLoreChapter()).toBe(GUESS);
    expect(story.takeLoreChapter()).toBeNull();
  });
});

describe('the store contract', () => {
  test('every change bumps the version and notifies, no-ops do neither', () => {
    const cb = vi.fn();
    const unsubscribe = story.subscribe(cb);
    const v0 = story.getVersion();
    story.knock(KNOCK); // a counter tick is a change: the tile shows the count
    expect(cb).toHaveBeenCalledTimes(1);
    story.guess(GUESS);
    expect(cb).toHaveBeenCalledTimes(2);
    expect(story.getVersion()).toBe(v0 + 2);
    story.guess(GUESS); // already open
    expect(cb).toHaveBeenCalledTimes(2);
    expect(story.getVersion()).toBe(v0 + 2);
    unsubscribe();
    story.knock(KNOCK);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  // The ordering React tears on: a subscriber that reads the snapshot must already
  // see the new one, or it renders the state it was told had changed.
  test('notifies after the version moves, never before', () => {
    const seen: number[] = [];
    const unsubscribe = story.subscribe(() => seen.push(story.getVersion()));
    const v0 = story.getVersion();
    story.guess(GUESS);
    story.knock(KNOCK);
    unsubscribe();
    expect(seen).toEqual([v0 + 1, v0 + 2]);
  });

  test('resetStory restores a pristine session without deafening the store', () => {
    const cb = vi.fn();
    const unsubscribe = story.subscribe(cb);
    story.knock(KNOCK);
    story.knock(KNOCK);
    story.knock(KNOCK);
    story.sprintPush(SPRINT, 0);
    story.dialogChoose(DIALOG, 1);
    const before = story.getVersion();
    story.resetStory();
    expect(CHAPTERS.some(story.isUnlocked)).toBe(false);
    expect(story.knockCount(KNOCK)).toBe(0);
    // Every quest's own half-finished progress goes with it, or a reload that is not
    // a reload hands the next visitor a sprint already up to speed.
    expect(story.sprintSpeed(SPRINT, 0)).toBe(0);
    expect(story.dialogState(DIALOG)).toEqual({ phase: 'ask', choice: null });
    expect(story.takeLoreChapter()).toBeNull();
    expect(cb).toHaveBeenCalledTimes(6); // three knocks, a push, a word, and the reset
    expect(story.getVersion()).toBeGreaterThan(before); // no subscriber left on a stale snapshot
    unsubscribe();
  });
});

describe('the cv quest', () => {
  test('opens only once the CV has actually been taken', () => {
    expect(story.syncCvQuest()).toBeNull();
    markCvDownloaded();
    expect(story.syncCvQuest()).toBe(CV);
    expect(story.syncCvQuest()).toBeNull(); // no re-unlock on the next render tick
  });
});

// The viewer walks the open chapters with the arrow keys, and every way that can go
// wrong is off-by-one arithmetic: the ends must wrap, a lone chapter must not move,
// and a covered neighbour must be stepped straight over rather than landed on.
describe('stepping across the open chapters', () => {
  const step = (open: story.ChapterId[], from: story.ChapterId, d: number) =>
    story.nextChapter(open, from, d);

  test('a set of one goes nowhere in either direction', () => {
    expect(step([SPRINT], SPRINT, 1)).toBe(SPRINT);
    expect(step([SPRINT], SPRINT, -1)).toBe(SPRINT);
  });

  test('the ends wrap, both ways', () => {
    const three = CHAPTERS.slice(0, 3);
    expect(step(three, three[2], 1)).toBe(three[0]);
    expect(step(three, three[0], -1)).toBe(three[2]);
  });

  test('a covered neighbour is stepped over, not landed on', () => {
    // Two quests with at least one chapter standing between them, left covered.
    story.knock(KNOCK);
    story.knock(KNOCK);
    story.knock(KNOCK);
    story.guess(GUESS);
    const open = CHAPTERS.filter(story.isUnlocked);
    expect(open).toHaveLength(2);
    expect(CHAPTERS.indexOf(open[1]) - CHAPTERS.indexOf(open[0])).toBeGreaterThan(1);
    expect(step(open, open[0], 1)).toBe(open[1]); // the covered ones in between are not in the list
    expect(step(open, open[1], 1)).toBe(open[0]); // and past the last one it wraps
  });

  test('a chapter that is not in the list stays put', () =>
    expect(step([SPRINT, KNOCK], GUESS, 1)).toBe(GUESS));
});
