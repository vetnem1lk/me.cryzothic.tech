// Two things break silently and only on screen: a uniform object that is
// recreated instead of re-bound (the colour reverts the next time a tone-map
// switch rebuilds the programs), and a second wire that replaces the objects
// the live program is already bound to. Both are pinned here, with no GL — the
// shader patch is string surgery and the uniforms are plain objects.
import { BufferGeometry, Color, Group, Mesh, MeshStandardMaterial } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSideTexture } from './characters';
import { MODULE_IDS, PRESETS, applyPreset, resetTint, setZoneColor, wireCharacter } from './tint';

// No network in tests. A fresh object per URL, so "both characters got the SAME
// texture" is a real assertion about the mask cache rather than a tautology.
vi.mock('./characters', () => ({
  loadSideTexture: vi.fn((url: string) => Promise.resolve({ url })),
}));

// The two chunks the patch keys off, in the order three emits them.
const FRAGMENT = ['#include <common>', 'void main() {', '#include <map_fragment>', '}'].join('\n');

interface Owned {
  uTintMask: { value: unknown };
  uZoneA: { value: Color };
  uZoneB: { value: Color };
  uZoneC: { value: Color };
}
type Wired = MeshStandardMaterial & { userData: { tint?: Owned } };

function tintable(name: string) {
  const material = new MeshStandardMaterial() as Wired;
  material.name = name;
  const root = new Group();
  root.add(new Mesh(new BufferGeometry(), material));
  return { material, root };
}

/** Run onBeforeCompile against a virgin uniform bag, exactly as three does. */
function compile(material: Wired) {
  const shader = { uniforms: {} as Record<string, unknown>, fragmentShader: FRAGMENT };
  material.onBeforeCompile(shader as never, null as never);
  return shader;
}

/** One macrotask: lets the mask promises settle onto the uniforms. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('preset table', () => {
  it('ships factory plus four curated sets and nothing called custom', () => {
    expect(Object.keys(PRESETS)).toEqual(['factory', 'stealth', 'ops', 'arctic', 'violet']);
  });

  it('covers every module of every preset with three parsable hexes', () => {
    for (const [id, table] of Object.entries(PRESETS))
      for (const module of MODULE_IDS) {
        expect(table[module], `${id}.${module}`).toHaveLength(3);
        for (const hex of table[module]) expect(hex, `${id}.${module}`).toMatch(/^#[0-9a-f]{6}$/);
      }
  });

  it('keeps factory pure white, so the default preset is a shader no-op', () => {
    for (const module of MODULE_IDS)
      expect(PRESETS.factory[module]).toEqual(['#ffffff', '#ffffff', '#ffffff']);
  });
});

describe('uniform ownership', () => {
  it('re-binds the SAME uniform objects on every recompile', () => {
    const { material, root } = tintable('MI_Gloves');
    wireCharacter(root);
    const owned = material.userData.tint;
    expect(owned).toBeDefined();

    // Twice, because once proves nothing: a tone-map assign or a bloom toggle
    // rebuilds every program and hands onBeforeCompile a brand-new bag.
    for (const pass of [1, 2]) {
      const shader = compile(material);
      expect(shader.uniforms.uTintMask, `pass ${pass}`).toBe(owned?.uTintMask);
      expect(shader.uniforms.uZoneA, `pass ${pass}`).toBe(owned?.uZoneA);
      expect(shader.uniforms.uZoneB, `pass ${pass}`).toBe(owned?.uZoneB);
      expect(shader.uniforms.uZoneC, `pass ${pass}`).toBe(owned?.uZoneC);
    }
  });

  it('injects byte-identical GLSL for every module, under one cache key', () => {
    const shoes = tintable('MI_Shoes');
    const pants = tintable('MI_Pants');
    wireCharacter(shoes.root);
    wireCharacter(pants.root);

    const patched = compile(shoes.material).fragmentShader;
    expect(compile(pants.material).fragmentShader).toBe(patched);
    expect(patched).toContain('uniform sampler2D uTintMask;');
    expect(patched).toContain('vec3 tintMask = texture2D(uTintMask, vMapUv).rgb;');
    expect(patched).toContain('diffuseColor.rgb *= tint;');
    expect(shoes.material.customProgramCacheKey()).toBe('g2tint');
    expect(pants.material.customProgramCacheKey()).toBe('g2tint');
  });

  it('wires a material once — a re-entered cached scene must not lose its uniforms', () => {
    const { material, root } = tintable('MI_Shirts');
    wireCharacter(root);
    const owned = material.userData.tint;
    const patch = material.onBeforeCompile;

    wireCharacter(root);
    expect(material.userData.tint).toBe(owned);
    expect(material.onBeforeCompile).toBe(patch);
  });

  it('leaves the cloth siblings alone — no mask covers them', () => {
    const { material, root } = tintable('MI_Shirts_CLoth');
    wireCharacter(root);
    expect(material.userData.tint).toBeUndefined();
  });
});

describe('colour writes', () => {
  beforeEach(() => applyPreset('factory'));

  it('mutates the owned Color in place instead of swapping the uniform', () => {
    const { material, root } = tintable('MI_Mask');
    wireCharacter(root);
    const owned = material.userData.tint;
    const before = owned?.uZoneB.value;

    setZoneColor('mask', 1, '#804020');
    expect(owned?.uZoneB.value).toBe(before);
    expect(before?.getHexString()).toBe('804020');
    expect(owned?.uZoneA.value.getHexString()).toBe('ffffff');
  });

  it('dresses a character wired AFTER a preset was applied', () => {
    applyPreset('violet');
    const { material, root } = tintable('MI_MShirts');
    wireCharacter(root);
    expect(material.userData.tint?.uZoneA.value.getHexString()).toBe(
      PRESETS.violet.shirts[0].slice(1),
    );
  });
});

// Hair is tintable but is NOT an outfit module. Two founder rules ride on that
// and neither is visible on screen until it is already wrong: a preset that
// repaints the hair, and a module picker that offers it as a sixth garment.
describe('hair', () => {
  beforeEach(() => resetTint());

  it('stays out of the module list, so the picker cannot offer it', () => {
    expect(MODULE_IDS).not.toContain('hair');
  });

  it('wires MI_Hair to its own sidecar — one material name for both characters', async () => {
    const { material, root } = tintable('MI_Hair');
    wireCharacter(root);
    expect(material.userData.tint).toBeDefined();

    setZoneColor('hair', 0, '#b497cf');
    await tick();
    expect(material.userData.tint?.uTintMask.value).toEqual({
      url: '/g2/v1/masks/Hair_M@1024.ktx2',
    });
    expect(material.userData.tint?.uZoneA.value.getHexString()).toBe('b497cf');
  });

  it('is left alone by an outfit preset, and leaves the outfit alone in return', () => {
    const hair = tintable('MI_Hair');
    const shirts = tintable('MI_Shirts');
    wireCharacter(hair.root);
    wireCharacter(shirts.root);

    setZoneColor('hair', 0, '#b497cf');
    applyPreset('ops');
    expect(hair.material.userData.tint?.uZoneA.value.getHexString()).toBe('b497cf');
    expect(shirts.material.userData.tint?.uZoneA.value.getHexString()).toBe(
      PRESETS.ops.shirts[0].slice(1),
    );

    setZoneColor('hair', 0, '#123456');
    expect(shirts.material.userData.tint?.uZoneA.value.getHexString()).toBe(
      PRESETS.ops.shirts[0].slice(1),
    );
  });

  // A fresh mount boots the HUD at white hair; the materials outlive it.
  it('goes back to white on the viewer reset that outfits already honour', () => {
    const { material, root } = tintable('MI_Hair');
    wireCharacter(root);
    setZoneColor('hair', 0, '#b497cf');
    resetTint();
    expect(material.userData.tint?.uZoneA.value.getHexString()).toBe('ffffff');
  });
});

describe('mask sidecars', () => {
  it('fetches a shared mask once and hands both characters the same texture', async () => {
    // Two separate GLBs, one mask file: M and F each have their own MI_Shoes
    // material object but the sidecar is shared.
    const m = tintable('MI_Shoes');
    const f = tintable('MI_Shoes');
    wireCharacter(m.root);
    wireCharacter(f.root);
    const placeholder = m.material.userData.tint?.uTintMask.value;
    expect(f.material.userData.tint?.uTintMask.value).toBe(placeholder);

    applyPreset('ops');
    await tick();
    const texture = m.material.userData.tint?.uTintMask.value;
    expect(texture).toEqual({ url: '/g2/v1/masks/Shoes_M@1024.ktx2' });
    expect(f.material.userData.tint?.uTintMask.value).toBe(texture);
    expect(loadSideTexture).toHaveBeenCalledWith('/g2/v1/masks/Shoes_M@1024.ktx2');
  });
});
