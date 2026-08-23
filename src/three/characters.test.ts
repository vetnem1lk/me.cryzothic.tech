// The registry doubles as the progress denominator and the head-swap map, so a
// silent edit here breaks loading UX and the visibility toggle at once — pin it.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnimationClip, Group, Mesh, NumberKeyframeTrack, Object3D } from 'three';
import {
  CHARACTERS,
  adoptScene,
  characterById,
  loadCharacter,
  onCharacterProgress,
  progressPct,
  setHeadSlots,
  trimLoopSeam,
} from './characters';

describe('character registry', () => {
  it('ships exactly the two closed models under the versioned path', () => {
    expect(CHARACTERS.map((c) => c.id)).toEqual(['m', 'f']);
    // Both are the retouched builds: M = b8, F = b9 (jacket-print cleanup, 2026-08-24).
    expect(characterById('m').glb).toBe('/g2/v1/scene_mb2_final.glb');
    expect(characterById('f').glb).toBe('/g2/v1/scene_fb2_final.glb');
  });

  it('pins the byte denominators to the closed GLB pair', () => {
    expect(characterById('m').bytes).toBe(5_849_356);
    expect(characterById('f').bytes).toBe(5_907_200);
  });

  it('maps both head slots to real node names per character', () => {
    expect(characterById('m').heads).toEqual({ hair: 'MHair', mask: 'MMask' });
    expect(characterById('f').heads).toEqual({ hair: 'FHair', mask: 'Mask' });
  });

  it('throws on an unknown id instead of returning undefined', () => {
    expect(() => characterById('x' as never)).toThrow(/unknown character/);
  });
});

describe('progressPct', () => {
  it('reports whole percentages clamped to 0..100', () => {
    expect(progressPct(0, 100)).toBe(0);
    expect(progressPct(50, 200)).toBe(25);
    expect(progressPct(5_849_572, 5_849_572)).toBe(100);
    expect(progressPct(6_000_000, 5_849_572)).toBe(100);
  });

  it('never divides by a zero or missing denominator', () => {
    expect(progressPct(1024, 0)).toBe(0);
    expect(progressPct(1024, -1)).toBe(0);
  });

  it('floors instead of rounding so 100 means actually done', () => {
    expect(progressPct(999, 1000)).toBe(99);
  });
});

// A scene shaped like what the loader hands back: one morph-carrying mesh and
// the two head nodes the registry names for M.
function fakeGltf() {
  const scene = new Group();
  const face = new Mesh();
  face.morphTargetDictionary = { Smile: 0, Blink: 1 };
  face.morphTargetInfluences = [0.6, 1];
  const hair = new Object3D();
  hair.name = 'MHair';
  const mask = new Object3D();
  mask.name = 'MMask';
  scene.add(face, hair, mask);
  return { gltf: { scene } as unknown as Parameters<typeof adoptScene>[0], face, hair, mask };
}

// The scenes are module-cached: what a viewer leaves on one is what the next
// viewer gets. A scene hidden by a character switch and never re-shown is an
// empty stage on the way back into /3d.
describe('adoptScene', () => {
  it('un-hides the scene, blanks the face and returns the morph meshes', () => {
    const { gltf, face } = fakeGltf();
    gltf.scene.visible = false;

    expect(adoptScene(gltf, characterById('m'))).toEqual([face]);
    expect(gltf.scene.visible).toBe(true);
    expect([...face.morphTargetInfluences!]).toEqual([0, 0]);
  });

  it('brings every arrival back on hair-on/mask-off, whatever it was left as', () => {
    const { gltf, hair, mask } = fakeGltf();
    hair.visible = false;
    mask.visible = true;

    adoptScene(gltf, characterById('m'));
    expect(hair.visible).toBe(true);
    expect(mask.visible).toBe(false);
  });
});

// Two flags, not a two-way switch: a mask over hair is the look the rig was
// authored for, and both off is a bald head the panel is allowed to ask for.
describe('setHeadSlots', () => {
  it('applies each flag independently, bald included', () => {
    const { gltf, hair, mask } = fakeGltf();
    const m = characterById('m');

    setHeadSlots(gltf.scene, m, { hair: true, mask: true });
    expect([hair.visible, mask.visible]).toEqual([true, true]);

    setHeadSlots(gltf.scene, m, { hair: false, mask: false });
    expect([hair.visible, mask.visible]).toEqual([false, false]);

    setHeadSlots(gltf.scene, m, { hair: false, mask: true });
    expect([hair.visible, mask.visible]).toEqual([false, true]);
  });
});

// Shaped like the shipped clips: keys start at frame 1, the key that closes the
// cycle repeats frame 0's value, and one more key repeats it again as padding.
const seamClip = (frames: number[], name = 'Walk') =>
  new AnimationClip(name, -1, [
    new NumberKeyframeTrack(
      '.x',
      frames.map((_, i) => (i + 1) / 30),
      frames,
    ),
  ]);

describe('trimLoopSeam', () => {
  it('drops the repeated tail key and lands the duration on the real cycle', () => {
    // 5 keys, 4 of them the cycle (0,1,2 then back to 0) plus one padding repeat.
    const clip = trimLoopSeam(seamClip([0, 1, 2, 0, 0]));
    expect(clip.tracks[0].times.length).toBe(4);
    expect(clip.tracks[0].times[0]).toBe(0);
    expect(clip.duration).toBeCloseTo(3 / 30, 6);
    // The pose at the wrap is frame 0's again — that is what makes it seamless.
    expect([...clip.tracks[0].values]).toEqual([0, 1, 2, 0]);
  });

  it('is idempotent, so a re-parsed or re-used clip is not trimmed twice', () => {
    const once = trimLoopSeam(seamClip([0, 1, 2, 0, 0]));
    const twice = trimLoopSeam(once);
    expect(twice.duration).toBeCloseTo(3 / 30, 6);
    expect([...twice.tracks[0].values]).toEqual([0, 1, 2, 0]);
  });

  it('leaves a clip with no padding alone apart from the frame-1 offset', () => {
    const clip = trimLoopSeam(seamClip([0, 1, 2, 0]));
    expect(clip.tracks[0].times.length).toBe(4);
    expect(clip.duration).toBeCloseTo(3 / 30, 6);
  });
});

// A body the test hand-feeds: every chunk lands exactly when it says so, which
// is what makes "a subscriber joins mid-stream" a fact instead of a race.
function scriptedBody() {
  type Chunk = { done: boolean; value?: Uint8Array };
  // Two queues, because the test pushes before the loader has asked: a chunk
  // waits for the next read(), and a read() with nothing queued waits for the
  // next push. Neither side may drop a chunk on the floor.
  const queued: Chunk[] = [];
  const waiting: ((chunk: Chunk) => void)[] = [];
  const emit = (chunk: Chunk) => {
    const reader = waiting.shift();
    if (reader) reader(chunk);
    else queued.push(chunk);
  };
  const read = () => {
    const chunk = queued.shift();
    return chunk ? Promise.resolve(chunk) : new Promise<Chunk>((resolve) => waiting.push(resolve));
  };
  return {
    response: { ok: true, body: { getReader: () => ({ read }) } },
    push: (bytes: number) => emit({ done: false, value: new Uint8Array(bytes) }),
    end: () => emit({ done: true }),
  };
}

/** One macrotask: drains every microtask the reader loop queued. */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('progress fan-out', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('feeds every subscriber, replays the last chunk to a late one, and stops on unsubscribe', async () => {
    const stream = scriptedBody();
    vi.stubGlobal('fetch', vi.fn(async () => stream.response));
    const quarter = characterById('m').bytes / 4;

    const starter: number[] = [];
    // The bytes are zeros, so the parse at the end rejects — irrelevant here,
    // this test is about what the stream says on its way through.
    const load = loadCharacter('m', (pct) => starter.push(pct));
    stream.push(quarter);
    await tick();

    const late: number[] = [];
    const off = onCharacterProgress('m', (pct) => late.push(pct));
    expect(late).toEqual([25]);

    stream.push(quarter);
    await tick();
    expect(starter).toEqual([25, 50]);
    expect(late).toEqual([25, 50]);

    off();
    stream.push(quarter);
    await tick();
    expect(starter).toEqual([25, 50, 75]);
    expect(late).toEqual([25, 50]);

    stream.end();
    await expect(load).rejects.toThrow();
    // Settled: nothing to replay, so a subscriber arriving now hears silence.
    const after: number[] = [];
    onCharacterProgress('m', (pct) => after.push(pct));
    expect(after).toEqual([]);
  });

  it('clears the reporters and drops the cache entry when a load fails', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    const seen: number[] = [];
    await expect(loadCharacter('f', (pct) => seen.push(pct))).rejects.toThrow(/HTTP 503/);
    expect(seen).toEqual([]);

    const after: number[] = [];
    onCharacterProgress('f', (pct) => after.push(pct));
    expect(after).toEqual([]);

    // The failed entry is gone, so the next visit re-fetches instead of
    // inheriting the rejection forever.
    await expect(loadCharacter('f')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
