// The HUD's single state atom. Kept pure and React-free so the whole control
// surface is testable without a GL context: ThreeDViewer owns the reducer and
// mirrors each change onto ViewerHandle, the clusters only dispatch.
import type { CharacterId, HeadFlags, HeadSlot } from '../../../../three/characters';
import type { ClipName, ToneMode, ViewerHandle } from '../../../../three/createViewer';
import { PRESETS, type ModuleId, type Zones } from '../../../../three/tint';

/** Blink is driven by the auto-blink timer, so it is not a slider. */
export type MorphName = 'Smile' | 'Angry' | 'ElfEars_02';

export interface HudState {
  clip: ClipName;
  speed: number;
  morphs: Record<MorphName, number>;
  autoBlink: boolean;
  character: CharacterId;
  /** Non-null only while the other character's GLB streams. */
  charProgress: number | null;
  /** Two independent flags — a mask over hair is a look, both off is bald. */
  head: HeadFlags;
  /** Hair tint, zone A only: the hair mask's G/B channels decode to zero. */
  hairColor: string;
  tone: ToneMode;
  exposure: number;
  bloom: boolean;
  autoRotate: boolean;
  /** A preset id, or 'custom' once a single zone has been touched by hand. */
  tintPreset: string;
  /** Which module the three zone pickers below are editing. */
  tintModule: ModuleId;
  tintZones: Record<ModuleId, Zones>;
  sheetOpen: boolean;
}

// Mirrors the viewer's own boot state (M in Idle at timeScale 0.7, hair on and
// mask off — the same pair adoptScene forces — untinted hair, Neutral tone
// mapping): the HUD must read as the truth on first paint, before a single
// control has been touched.
export const HUD_DEFAULTS: HudState = {
  clip: 'Idle',
  speed: 0.7,
  morphs: { Smile: 0, Angry: 0, ElfEars_02: 0 },
  autoBlink: true,
  character: 'm',
  charProgress: null,
  head: { hair: true, mask: false },
  hairColor: '#ffffff',
  tone: 'neutral',
  exposure: 1,
  bloom: true,
  autoRotate: false,
  tintPreset: 'factory',
  tintModule: 'shirts',
  // Copied, not aliased: the reducer replaces this record, but a shared
  // reference to the preset table is one careless spread away from a bug.
  tintZones: { ...PRESETS.factory },
  sheetOpen: false,
};

/**
 * One panel drives both characters, so an arrival has to inherit it: a runtime
 * that just came up stands in Idle with a blank face and the hair head, and the
 * HUD would be describing the character that left. Only the per-character state
 * belongs here — speed is pushed to every mixer by setClipSpeed, auto-blink is
 * one viewer-wide flag, and tone/exposure/bloom/auto-rotate live on the renderer.
 */
export function applyHudToViewer(viewer: ViewerHandle, hud: HudState): void {
  // Nothing of this rig was on screen a frame ago, so there is nothing to blend
  // from. Idle-on-Idle is a no-op inside the viewer, which is what keeps the
  // reduced-motion freeze frozen: that pose is only left when the user asks.
  viewer.setClip(hud.clip, 0);
  for (const [name, value] of Object.entries(hud.morphs)) viewer.setMorph(name, value);
  viewer.setHead(hud.head);
  // Hair zones are module-scope in tint.ts, so the arriving MI_Hair is already
  // dressed by wireCharacter — this re-write is the cheap way to keep that a
  // property of the panel rather than a property of where the state happens to
  // live today. Zone A only: the hair mask's other two channels are zero.
  viewer.tint?.setZoneColor('hair', 0, hud.hairColor);
}

export type HudAction =
  | { type: 'setClip'; value: ClipName }
  | { type: 'setSpeed'; value: number }
  | { type: 'setMorph'; name: MorphName; value: number }
  | { type: 'setAutoBlink'; value: boolean }
  | { type: 'setCharacter'; value: CharacterId }
  | { type: 'setCharProgress'; value: number | null }
  | { type: 'setHead'; slot: HeadSlot; value: boolean }
  | { type: 'setHairColor'; value: string }
  | { type: 'setTone'; value: ToneMode }
  | { type: 'setExposure'; value: number }
  | { type: 'setBloom'; value: boolean }
  | { type: 'setAutoRotate'; value: boolean }
  | { type: 'setTintPreset'; value: string }
  | { type: 'setTintModule'; value: ModuleId }
  | { type: 'setTintZone'; module: ModuleId; zone: 0 | 1 | 2; hex: string }
  | { type: 'toggleSheet' };

export function hudReducer(state: HudState, action: HudAction): HudState {
  switch (action.type) {
    case 'setClip':
      return { ...state, clip: action.value };
    case 'setSpeed':
      return { ...state, speed: action.value };
    case 'setMorph':
      return { ...state, morphs: { ...state.morphs, [action.name]: action.value } };
    case 'setAutoBlink':
      return { ...state, autoBlink: action.value };
    case 'setCharacter':
      return { ...state, character: action.value };
    case 'setCharProgress':
      return { ...state, charProgress: action.value };
    case 'setHead':
      return { ...state, head: { ...state.head, [action.slot]: action.value } };
    case 'setHairColor':
      return { ...state, hairColor: action.value };
    case 'setTone':
      return { ...state, tone: action.value };
    case 'setExposure':
      return { ...state, exposure: action.value };
    case 'setBloom':
      return { ...state, bloom: action.value };
    case 'setAutoRotate':
      return { ...state, autoRotate: action.value };
    case 'setTintPreset':
      // Custom editing starts from what is on screen, so the preset's own table
      // becomes the pickers' state — not a reset to white.
      return {
        ...state,
        tintPreset: action.value,
        tintZones: { ...(PRESETS[action.value] ?? PRESETS.factory) },
      };
    case 'setTintModule':
      return { ...state, tintModule: action.value };
    case 'setTintZone': {
      const next: [string, string, string] = [...state.tintZones[action.module]];
      next[action.zone] = action.hex;
      return {
        ...state,
        tintPreset: 'custom',
        tintZones: { ...state.tintZones, [action.module]: next },
      };
    }
    case 'toggleSheet':
      return { ...state, sheetOpen: !state.sheetOpen };
    default:
      // Unreachable through the union, but a dropped case must not blank the HUD.
      return state;
  }
}
