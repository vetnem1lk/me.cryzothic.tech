// The HUD's single state atom. Kept pure and React-free so the whole control
// surface is testable without a GL context: ThreeDViewer owns the reducer and
// mirrors each change onto ViewerHandle, the clusters only dispatch.
import type { CharacterId, HeadSlot } from '../../../../three/characters';
import type { ClipName, ToneMode } from '../../../../three/createViewer';

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
  head: HeadSlot;
  tone: ToneMode;
  exposure: number;
  bloom: boolean;
  autoRotate: boolean;
  sheetOpen: boolean;
}

// Mirrors the viewer's own boot state (M in Idle at timeScale 0.7, hair head,
// Neutral tone mapping): the HUD must read as the truth on first paint, before
// a single control has been touched.
export const HUD_DEFAULTS: HudState = {
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
};

export type HudAction =
  | { type: 'setClip'; value: ClipName }
  | { type: 'setSpeed'; value: number }
  | { type: 'setMorph'; name: MorphName; value: number }
  | { type: 'setAutoBlink'; value: boolean }
  | { type: 'setCharacter'; value: CharacterId }
  | { type: 'setCharProgress'; value: number | null }
  | { type: 'setHead'; value: HeadSlot }
  | { type: 'setTone'; value: ToneMode }
  | { type: 'setExposure'; value: number }
  | { type: 'setBloom'; value: boolean }
  | { type: 'setAutoRotate'; value: boolean }
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
      return { ...state, head: action.value };
    case 'setTone':
      return { ...state, tone: action.value };
    case 'setExposure':
      return { ...state, exposure: action.value };
    case 'setBloom':
      return { ...state, bloom: action.value };
    case 'setAutoRotate':
      return { ...state, autoRotate: action.value };
    case 'toggleSheet':
      return { ...state, sheetOpen: !state.sheetOpen };
    default:
      // Unreachable through the union, but a dropped case must not blank the HUD.
      return state;
  }
}
