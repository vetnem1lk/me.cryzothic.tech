// The character registry and loader stack. Assets live under the versioned
// /g2/v1/ path on the host, never in this repo; `bytes` is the progress
// denominator, pinned here because the CDN answers chunked (no content-length).
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { NoColorSpace, type Texture, type WebGLRenderer } from 'three';

export interface Character {
  id: 'm' | 'f';
  glb: string;
  bytes: number;
  label: string;
  /** Head-slot node names inside the GLB — swap is a visibility toggle. */
  heads: { hair: string; mask: string };
}

export type CharacterId = Character['id'];
export type HeadSlot = keyof Character['heads'];

export const CHARACTERS: readonly Character[] = [
  {
    id: 'm',
    glb: '/g2/v1/scene_mb_final.glb',
    bytes: 5_849_572,
    label: 'M',
    heads: { hair: 'MHair', mask: 'MMask' },
  },
  {
    id: 'f',
    glb: '/g2/v1/scene_fb_final.glb',
    bytes: 5_907_552,
    label: 'F',
    heads: { hair: 'FHair', mask: 'Mask' },
  },
];

export function characterById(id: CharacterId): Character {
  const hit = CHARACTERS.find((c) => c.id === id);
  if (!hit) throw new Error(`unknown character ${id}`);
  return hit;
}

/** Integer 0..100, safe against a zero/absent denominator. */
export function progressPct(received: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.floor((received / total) * 100));
}

// One loader stack for the whole session. The KTX2 worker pool and the parsed
// cache below deliberately live at module scope: leaving /3d and coming back
// re-uses the parsed scenes, and re-uploading textures into a fresh GL context
// is cheap (ETC1S stays compressed end to end) — no re-fetch, no re-transcode.
const ktx2 = new KTX2Loader().setWorkerLimit(2);
const gltfLoader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);

/** Must run before any load, and again for every new renderer (new GL context). */
export function detectSupport(renderer: WebGLRenderer): void {
  ktx2.detectSupport(renderer);
}

/**
 * A KTX2 sidecar that is not part of a GLB — today the tint zone masks. Rides
 * the same transcoder pool as the models, so it costs no extra worker. The
 * masks are DATA (three zone weights per texel), never colour: an sRGB decode
 * would bend those weights, so the colour space is forced off. flipY stays as
 * the loader sets it — the masks share the baseColor UV layout, and that is
 * what `vMapUv` samples.
 */
export function loadSideTexture(url: string): Promise<Texture> {
  return ktx2.loadAsync(url).then((texture) => {
    texture.colorSpace = NoColorSpace;
    return texture;
  });
}

const cache = new Map<CharacterId, Promise<GLTF>>();

async function fetchWithProgress(
  url: string,
  total: number,
  onProgress: (pct: number) => void,
): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  if (!res.body) {
    const buffer = await res.arrayBuffer();
    onProgress(100);
    return buffer;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as Uint8Array<ArrayBuffer>);
    received += value.length;
    onProgress(progressPct(received, total));
  }
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged.buffer;
}

// Progress fan-out. Whoever reaches a GLB first starts its load — boot, the idle
// prefetch, or the HUD switcher — but everyone who cares has to see the same
// bytes, so the subscribers live beside the cache instead of being captured by
// that first caller. `lastPct` doubles as the in-flight marker: an entry means a
// stream is open, so a late joiner can be replayed instead of sitting at 0.
const reporters = new Map<CharacterId, Set<(pct: number) => void>>();
const lastPct = new Map<CharacterId, number>();

function subscribe(id: CharacterId, cb: (pct: number) => void): () => void {
  let set = reporters.get(id);
  if (!set) {
    set = new Set();
    reporters.set(id, set);
  }
  set.add(cb);
  return () => {
    reporters.get(id)?.delete(cb);
  };
}

/**
 * Watch a load that somebody ELSE may have started — the HUD subscribes, the
 * viewer's setCharacter() is what opens the stream. Replays the last known
 * percentage on subscribe, so a late joiner is never stuck at 0 until the next
 * chunk lands, and reports nothing at all when no load is in flight. Returns
 * the unsubscribe.
 */
export function onCharacterProgress(id: CharacterId, cb: (pct: number) => void): () => void {
  const off = subscribe(id, cb);
  const seen = lastPct.get(id);
  if (seen !== undefined) cb(seen);
  return off;
}

/**
 * Load (or re-use) a character's parsed glTF. Progress reports real received
 * bytes against the registry denominator, fanned out to every subscriber for
 * that id; a callback passed here is one of them and lives until the load
 * settles. Anyone arriving after the start subscribes via onCharacterProgress().
 */
export function loadCharacter(id: CharacterId, onProgress?: (pct: number) => void): Promise<GLTF> {
  const cached = cache.get(id);
  if (cached) {
    // Still streaming: join the fan-out. Already parsed: there is nothing left
    // to stream, and 100 is what done has always looked like to a caller.
    if (onProgress) {
      if (lastPct.has(id)) onCharacterProgress(id, onProgress);
      else onProgress(100);
    }
    return cached;
  }
  const character = characterById(id);
  lastPct.set(id, 0);
  if (onProgress) subscribe(id, onProgress);
  const loading = fetchWithProgress(character.glb, character.bytes, (pct) => {
    lastPct.set(id, pct);
    for (const cb of reporters.get(id) ?? []) cb(pct);
  }).then((buffer) => gltfLoader.parseAsync(buffer, '/g2/v1/'));
  const settle = () => {
    reporters.delete(id);
    lastPct.delete(id);
  };
  loading.then(settle, () => {
    settle();
    // A failed fetch must not poison re-entry: drop it so the next visit retries.
    cache.delete(id);
  });
  cache.set(id, loading);
  return loading;
}

/** Show one head variant, hide the other. Node names come from the registry. */
export function setHeadSlot(gltf: GLTF, character: Character, slot: HeadSlot): void {
  for (const [key, nodeName] of Object.entries(character.heads)) {
    const node = gltf.scene.getObjectByName(nodeName);
    if (node) node.visible = key === slot;
  }
}
