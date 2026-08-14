// The defaults are a contract with the viewer's boot state, and every cluster
// dispatches blind — a reducer that touched a neighbouring slice would desync
// the HUD from the scene with nothing on screen to say so.
import { describe, expect, it } from 'vitest';
import { HUD_DEFAULTS, hudReducer, type HudAction, type HudState } from './hudState';

describe('HUD defaults', () => {
  it('boots the panel on the same state the viewer boots on', () => {
    expect(HUD_DEFAULTS).toEqual({
      clip: 'Idle',
      speed: 0.7,
      morphs: { Smile: 0, Angry: 0, ElfEars_02: 0 },
      autoBlink: true,
      character: 'm',
      charProgress: null,
      head: 'hair',
      tone: 'neutral',
      exposure: 1,
      bloom: true,
      autoRotate: false,
      sheetOpen: false,
    });
  });
});

describe('hudReducer', () => {
  const cases: [HudAction, Partial<HudState>][] = [
    [{ type: 'setClip', value: 'Walk' }, { clip: 'Walk' }],
    [{ type: 'setSpeed', value: 1.5 }, { speed: 1.5 }],
    [{ type: 'setAutoBlink', value: false }, { autoBlink: false }],
    [{ type: 'setCharacter', value: 'f' }, { character: 'f' }],
    [{ type: 'setCharProgress', value: 42 }, { charProgress: 42 }],
    [{ type: 'setHead', value: 'mask' }, { head: 'mask' }],
    [{ type: 'setTone', value: 'agx' }, { tone: 'agx' }],
    [{ type: 'setExposure', value: 1.4 }, { exposure: 1.4 }],
    [{ type: 'setBloom', value: false }, { bloom: false }],
    [{ type: 'setAutoRotate', value: true }, { autoRotate: true }],
    [{ type: 'toggleSheet' }, { sheetOpen: true }],
  ];

  it('changes exactly its own slice, action by action', () => {
    for (const [action, patch] of cases) {
      expect(hudReducer(HUD_DEFAULTS, action), action.type).toEqual({ ...HUD_DEFAULTS, ...patch });
    }
  });

  it('moves one morph and leaves the others where they were', () => {
    const next = hudReducer(HUD_DEFAULTS, { type: 'setMorph', name: 'Smile', value: 0.6 });
    expect(next.morphs).toEqual({ Smile: 0.6, Angry: 0, ElfEars_02: 0 });
    expect(HUD_DEFAULTS.morphs.Smile).toBe(0);
  });

  it('toggles the mobile sheet both ways', () => {
    const open = hudReducer(HUD_DEFAULTS, { type: 'toggleSheet' });
    expect(hudReducer(open, { type: 'toggleSheet' }).sheetOpen).toBe(false);
  });

  it('returns the same state for an action it does not know', () => {
    expect(hudReducer(HUD_DEFAULTS, { type: 'setTint' } as unknown as HudAction)).toBe(
      HUD_DEFAULTS,
    );
  });
});
