// The character registry and loader stack. Assets live under the versioned
// /g2/v1/ path on the host, never in this repo; `bytes` is the progress
// denominator, pinned here because the CDN answers chunked (no content-length).
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { WebGLRenderer } from 'three';

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

/**
 * Load (or re-use) a character's parsed glTF. Progress reports real received
 * bytes against the registry denominator.
 * ponytail: only the first caller of an in-flight load sees progress; the B2
 * switcher can thread a shared reporter through if the inline bar needs it.
 */
export function loadCharacter(id: CharacterId, onProgress?: (pct: number) => void): Promise<GLTF> {
  const cached = cache.get(id);
  if (cached) {
    onProgress?.(100);
    return cached;
  }
  const character = characterById(id);
  const loading = fetchWithProgress(character.glb, character.bytes, onProgress ?? (() => {})).then(
    (buffer) => gltfLoader.parseAsync(buffer, '/g2/v1/'),
  );
  // A failed fetch must not poison re-entry: drop it so the next visit retries.
  loading.catch(() => cache.delete(id));
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
