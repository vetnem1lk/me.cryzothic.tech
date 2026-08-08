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
const CLICK = guarding('click');
const CV = guarding('cv');
const others = (id: story.ChapterId) => CHAPTERS.filter((c) => c !== id);

beforeEach(() => {
  story.resetStory();
  resetCvFlag();
});

describe('the quest table', () => {
  test('is seven chapters: three quests, one declassify and three click slots', () => {
    const count = (q: story.Quest) => CHAPTERS.filter((c) => QUESTS[c] === q).length;
    expect(CHAPTERS).toHaveLength(7);
    expect([count('knock'), count('guess'), count('cv'), count('declassify'), count('click')]) //
      .toEqual([1, 1, 1, 1, 3]);
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

describe('clickUnlock', () => {
  test('one click lifts a placeholder cover', () => {
    expect(story.clickUnlock(CLICK)).toBe(true);
    expect(story.clickUnlock(CLICK)).toBe(false);
  });

  test('never opens a tile that carries a real quest', () => {
    for (const id of CHAPTERS.filter((c) => QUESTS[c] !== 'click')) {
      expect(story.clickUnlock(id)).toBe(false);
      expect(story.isUnlocked(id)).toBe(false);
    }
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
    story.knock(KNOCK); // a counter tick is a change: the tile shows 1/3
    expect(cb).toHaveBeenCalledTimes(1);
    story.clickUnlock(CLICK);
    expect(cb).toHaveBeenCalledTimes(2);
    expect(story.getVersion()).toBe(v0 + 2);
    story.clickUnlock(CLICK); // already open
    expect(cb).toHaveBeenCalledTimes(2);
    expect(story.getVersion()).toBe(v0 + 2);
    unsubscribe();
    story.guess(GUESS);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  // The ordering React tears on: a subscriber that reads the snapshot must already
  // see the new one, or it renders the state it was told had changed.
  test('notifies after the version moves, never before', () => {
    const seen: number[] = [];
    const unsubscribe = story.subscribe(() => seen.push(story.getVersion()));
    const v0 = story.getVersion();
    story.clickUnlock(CLICK);
    story.guess(GUESS);
    unsubscribe();
    expect(seen).toEqual([v0 + 1, v0 + 2]);
  });

  test('resetStory restores a pristine session without deafening the store', () => {
    const cb = vi.fn();
    const unsubscribe = story.subscribe(cb);
    story.knock(KNOCK);
    story.knock(KNOCK);
    story.knock(KNOCK);
    const before = story.getVersion();
    story.resetStory();
    expect(CHAPTERS.some(story.isUnlocked)).toBe(false);
    expect(story.knockCount(KNOCK)).toBe(0);
    expect(story.takeLoreChapter()).toBeNull();
    expect(cb).toHaveBeenCalledTimes(4); // three knocks and the reset itself
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
