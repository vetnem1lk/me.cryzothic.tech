// Zone-mask outfit tint. Each tintable module carries an ETC1S mask sidecar
// whose R/G/B channels are three independent zones (black = untintable, so the
// prints and zips are protected by construction), and three colour uniforms
// that multiply into the baseColor. Two pins hold the whole thing up:
//
//  1. UNIFORM OWNERSHIP. A tone-mapping assign or a render↔composer flip
//     rebuilds every program, and three hands `onBeforeCompile` a FRESH uniform
//     bag each time. So the uniform objects live on `material.userData.tint`
//     and are re-bound into that bag on every recompile — the values survive
//     because the objects are never recreated.
//  2. ONE PROGRAM. The injected GLSL is byte-identical for every module (they
//     differ by uniform VALUES only) and `customProgramCacheKey` is a single
//     constant, so all tinted materials share one compiled program.
//
// State is module-scope on purpose: the parsed-GLTF cache keeps the materials
// alive across /3d unmounts, so tint state has to outlive the viewer the same
// way the morph influences already do. Nothing here is per-viewer.
import { Color, DataTexture, type Material, type Mesh, type Object3D, type Texture } from 'three';
import { loadSideTexture } from './characters';

export const MODULE_IDS = ['shirts', 'pants', 'gloves', 'shoes', 'mask'] as const;
export type ModuleId = (typeof MODULE_IDS)[number];
/** One module's three zone colours, in R/G/B mask-channel order. */
export type Zones = readonly [string, string, string];

// Material name → module + mask sidecar, measured from the shipped GLBs. The
// lookup is exact-name and that IS the fuse: `MI_Shirts_CLoth` and
// `MI_Pants_Cloth` are real material names in those files, carry no mask, and
// therefore stay untinted. Shirts differ per character (M/F have their own
// material AND their own mask); the other four share a mask across both.
const MASKS = '/g2/v1/masks/';
const MATERIALS: Record<string, { module: ModuleId; mask: string }> = {
  MI_MShirts: { module: 'shirts', mask: 'MShirts_M@1024.ktx2' },
  MI_Shirts: { module: 'shirts', mask: 'Shirts_M@1024.ktx2' },
  MI_Pants: { module: 'pants', mask: 'Pants_M@1024.ktx2' },
  MI_Gloves: { module: 'gloves', mask: 'Gloves_M@1024.ktx2' },
  MI_Shoes: { module: 'shoes', mask: 'Shoes_M@1024.ktx2' },
  MI_Mask: { module: 'mask', mask: 'Mask_M@1024.ktx2' },
};

// Zone triples, named once and re-used across modules: an outfit preset is one
// palette worn by five modules, and the table is on the viewer chunk's budget.
// Everything is mid-to-light on purpose — the tint MULTIPLIES, so a saturated
// primary reads as poster paint instead of fabric.
const WHITE: Zones = ['#ffffff', '#ffffff', '#ffffff'];
const GRAPHITE: Zones = ['#4a4a52', '#33333a', '#5e5e68'];
const COAL: Zones = ['#33333a', '#26262c', '#44444c'];
const GUNMETAL: Zones = ['#5a606c', '#3c414a', '#79808e'];
const CRIMSON: Zones = ['#8e3038', '#3a2a2c', '#c2545c'];
const SNOW: Zones = ['#eef1f6', '#c6cdd8', '#9aa4b2'];
const STEEL: Zones = ['#aab4c2', '#7d8794', '#c8d0da'];
const LILAC: Zones = ['#b497cf', '#8a74a4', '#d8cbe6'];
const PLUM: Zones = ['#6f5f86', '#4b4059', '#9a86b4'];

/** Factory plus four curated sets. `custom` is a HUD state, never an entry. */
export const PRESETS: Record<string, Record<ModuleId, Zones>> = {
  factory: { shirts: WHITE, pants: WHITE, gloves: WHITE, shoes: WHITE, mask: WHITE },
  stealth: { shirts: GRAPHITE, pants: GRAPHITE, gloves: COAL, shoes: COAL, mask: GUNMETAL },
  ops: { shirts: CRIMSON, pants: COAL, gloves: COAL, shoes: COAL, mask: CRIMSON },
  arctic: { shirts: SNOW, pants: STEEL, gloves: STEEL, shoes: STEEL, mask: SNOW },
  violet: { shirts: LILAC, pants: PLUM, gloves: PLUM, shoes: PLUM, mask: LILAC },
};

interface TintUniforms {
  uTintMask: { value: Texture };
  uZoneA: { value: Color };
  uZoneB: { value: Color };
  uZoneC: { value: Color };
}

type TintMaterial = Material & { userData: { tint?: TintUniforms } };

// The declarations and the patch are constants, not per-module strings: that is
// what makes every tinted material compile to the same program.
const DECLARATIONS = /* glsl */ `
uniform sampler2D uTintMask;
uniform vec3 uZoneA;
uniform vec3 uZoneB;
uniform vec3 uZoneC;
`;

// A white zone is a mathematical no-op and a black mask texel is untouched, so
// the untinted state needs no on/off uniform — and neither does a module whose
// mask has not been fetched yet.
const PATCH = /* glsl */ `
vec3 tintMask = texture2D(uTintMask, vMapUv).rgb;
vec3 tint = mix(vec3(1.0), uZoneA, tintMask.r) * mix(vec3(1.0), uZoneB, tintMask.g) * mix(vec3(1.0), uZoneC, tintMask.b);
diffuseColor.rgb *= tint;
`;

// Until a real mask lands, every material samples this shared 1×1 BLACK texel:
// black = fully untintable, so the shader is a no-op and nothing is fetched.
// Static and shared for the process — there is no dispose() here because there
// is nothing per-viewer to free; the mask textures below are cached at module
// scope for the same reason the parsed scenes are.
const PLACEHOLDER = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
PLACEHOLDER.needsUpdate = true;

interface Entry {
  uniforms: TintUniforms;
  module: ModuleId;
  mask: string;
}

const wired: Entry[] = [];
const zones: Record<ModuleId, Zones> = { ...PRESETS.factory };
const masks = new Map<string, Promise<Texture>>();
// Network-lazy: masks are fetched on the FIRST real tint interaction, never on
// boot. Once engaged, a character wired later fetches its own masks on arrival.
let engaged = false;

function loadMask(file: string): Promise<Texture> {
  let hit = masks.get(file);
  if (!hit) {
    hit = loadSideTexture(MASKS + file);
    // A failed fetch must not poison the module forever: drop it so the next
    // interaction retries. Until then the placeholder keeps the model untinted.
    void hit.catch(() => masks.delete(file));
    masks.set(file, hit);
  }
  return hit;
}

function attachMask(entry: Entry): void {
  void loadMask(entry.mask).then(
    (texture) => {
      // A texture uniform's value can be swapped live — no recompile, no flag.
      entry.uniforms.uTintMask.value = texture;
    },
    () => {
      // Mask unavailable: the zones stay no-ops and the module renders as shipped.
    },
  );
}

function engage(): void {
  if (engaged) return;
  engaged = true;
  for (const entry of wired) attachMask(entry);
}

function writeZones(entry: Entry): void {
  const [a, b, c] = zones[entry.module];
  // Mutating the OWNED Color in place is the point: the uniform object the
  // program is bound to never changes identity, so the value is live.
  entry.uniforms.uZoneA.value.set(a);
  entry.uniforms.uZoneB.value.set(b);
  entry.uniforms.uZoneC.value.set(c);
}

function wireMaterial(material: TintMaterial): void {
  const slot = MATERIALS[material.name];
  if (!slot || material.userData.tint) return;
  const uniforms: TintUniforms = {
    uTintMask: { value: PLACEHOLDER },
    uZoneA: { value: new Color(1, 1, 1) },
    uZoneB: { value: new Color(1, 1, 1) },
    uZoneC: { value: new Color(1, 1, 1) },
  };
  material.userData.tint = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${DECLARATIONS}`)
      .replace('#include <map_fragment>', `#include <map_fragment>\n${PATCH}`);
  };
  // Appended to three's own key, so materials with different feature sets still
  // get their own program — this only stops the tinted ones from splitting.
  material.customProgramCacheKey = () => 'g2tint';
  const entry: Entry = { uniforms, module: slot.module, mask: slot.mask };
  wired.push(entry);
  // A character that arrives after a preset was applied must come in dressed.
  writeZones(entry);
  if (engaged) attachMask(entry);
}

/**
 * Patch every tintable material in a loaded character. Idempotent: the parsed
 * scenes are cached at module scope, so leaving and re-entering /3d hands back
 * the SAME material objects — re-wiring them would drop the uniforms the live
 * programs are bound to.
 */
export function wireCharacter(root: Object3D): void {
  root.traverse((object) => {
    const { material } = object as Mesh;
    if (!material) return;
    if (Array.isArray(material)) for (const m of material) wireMaterial(m as TintMaterial);
    else wireMaterial(material as TintMaterial);
  });
}

/**
 * Back to factory white. The cached materials outlive the viewer, but the HUD
 * does not — a fresh mount boots with factory state, so the outfit must match
 * it (the head slot already resets the same way at addRuntime).
 */
export function resetTint(): void {
  for (const module of MODULE_IDS) zones[module] = PRESETS.factory[module];
  for (const entry of wired) writeZones(entry);
}

/** Dress every module from a preset. Unknown id falls back to factory. */
export function applyPreset(id: string): void {
  const preset = PRESETS[id] ?? PRESETS.factory;
  for (const module of MODULE_IDS) zones[module] = preset[module];
  if (preset !== PRESETS.factory) engage();
  for (const entry of wired) writeZones(entry);
}

/** One zone of one module, from a colour input. Live: no recompile, no reload. */
export function setZoneColor(module: ModuleId, zone: 0 | 1 | 2, hex: string): void {
  const next: [string, string, string] = [...zones[module]];
  next[zone] = hex;
  zones[module] = next;
  engage();
  for (const entry of wired) if (entry.module === module) writeZones(entry);
}
