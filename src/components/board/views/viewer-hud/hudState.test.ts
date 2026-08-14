// The defaults are a contract with the viewer's boot state, and every cluster
// dispatches blind — a reducer that touched a neighbouring slice would desync
// the HUD from the scene with nothing on screen to say so.
import { describe, expect, it } from 'vitest';
import type { ViewerHandle } from '../../../../three/createViewer';
import { PRESETS } from '../../../../three/tint';
import {
  HUD_DEFAULTS,
  applyHudToViewer,
  hudReducer,
  type HudAction,
  type HudState,
} from './hudState';

const UNTINTED: [string, string, string] = ['#ffffff', '#ffffff', '#ffffff'];

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
      tintPreset: 'factory',
      tintModule: 'shirts',
      tintZones: {
        shirts: UNTINTED,
        pants: UNTINTED,
        gloves: UNTINTED,
        shoes: UNTINTED,
        mask: UNTINTED,
      },
      sheetOpen: false,
    });
  });

  it('copies the factory table instead of aliasing it', () => {
    expect(HUD_DEFAULTS.tintZones).not.toBe(PRESETS.factory);
  });
});

// Every entry point the handle offers, logged: the assertions then read as the
// WHOLE conversation with the viewer, so a stray call is a failure and not a
// detail nobody checked.
function mockViewer() {
  const calls: string[] = [];
  const log =
    (label: string) =>
    (...args: unknown[]) =>
      calls.push([label, ...args].join(':'));
  const viewer = {
    setClip: log('clip'),
    setClipSpeed: log('speed'),
    setMorph: log('morph'),
    setAutoBlink: log('blink'),
    setCharacter: log('character'),
    setHead: log('head'),
    render: {
      setBloom: log('bloom'),
      setToneMapping: log('tone'),
      setExposure: log('exposure'),
      setAutoRotate: log('autoRotate'),
    },
  } as unknown as ViewerHandle;
  return { viewer, calls };
}

describe('applyHudToViewer', () => {
  // The panel does not move when the pad does, so the arriving character has to.
  it('hands the arriving character the clip, the face and the head on the panel', () => {
    const { viewer, calls } = mockViewer();
    const hud: HudState = {
      ...HUD_DEFAULTS,
      clip: 'Walk',
      morphs: { Smile: 0.6, Angry: 0, ElfEars_02: 1 },
      head: 'mask',
    };

    applyHudToViewer(viewer, hud);

    expect(calls).toEqual([
      // Fade 0: nothing of this rig was on screen to blend from.
      'clip:Walk:0',
      'morph:Smile:0.6',
      'morph:Angry:0',
      'morph:ElfEars_02:1',
      'head:mask',
    ]);
  });

  // Speed rides every mixer, auto-blink is one viewer-wide flag and the render
  // controls live on the renderer — all four outlive a switch untouched.
  it('leaves the viewer-wide and renderer state alone', () => {
    const { viewer, calls } = mockViewer();
    applyHudToViewer(viewer, { ...HUD_DEFAULTS, speed: 1.5, autoBlink: false, bloom: false });
    expect(calls.filter((c) => !/^(clip|morph|head)/.test(c))).toEqual([]);
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
    [{ type: 'setTintModule', value: 'shoes' }, { tintModule: 'shoes' }],
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

  // Custom editing has to start from the outfit on screen, not from white:
  // picking "stealth" then nudging one zone must nudge a stealth colour.
  it('loads the preset table into the pickers, and falls back to factory', () => {
    const next = hudReducer(HUD_DEFAULTS, { type: 'setTintPreset', value: 'violet' });
    expect(next.tintPreset).toBe('violet');
    expect(next.tintZones).toEqual(PRESETS.violet);
    expect(next.tintZones).not.toBe(PRESETS.violet);
    const unknown = hudReducer(next, { type: 'setTintPreset', value: 'nope' });
    expect(unknown.tintZones.shirts).toEqual(UNTINTED);
  });

  it('drops to custom on a hand-picked zone, moving that zone only', () => {
    const violet = hudReducer(HUD_DEFAULTS, { type: 'setTintPreset', value: 'violet' });
    const next = hudReducer(violet, {
      type: 'setTintZone',
      module: 'gloves',
      zone: 2,
      hex: '#123456',
    });
    expect(next.tintPreset).toBe('custom');
    expect(next.tintZones.gloves).toEqual([
      PRESETS.violet.gloves[0],
      PRESETS.violet.gloves[1],
      '#123456',
    ]);
    expect(next.tintZones.shirts).toBe(violet.tintZones.shirts);
    expect(violet.tintZones.gloves).toEqual(PRESETS.violet.gloves);
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
