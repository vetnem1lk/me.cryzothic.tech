// The viewer runtime: renderer, scene, camera, controls, load/animate/dispose.
// Everything here lives behind the /3d dynamic import; the only consumer-facing
// surface is ViewerHandle, which reaches eager files as `import type` only.
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  AnimationMixer,
  Box3,
  Clock,
  Color,
  DirectionalLight,
  HemisphereLight,
  NeutralToneMapping,
  PMREMGenerator,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type AnimationAction,
  type Group,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  characterById,
  detectSupport,
  loadCharacter,
  setHeadSlot,
  type CharacterId,
  type HeadSlot,
} from './characters';

export type ClipName = 'Idle' | 'Walk';
export type ToneMode = 'neutral' | 'aces' | 'agx';

// The contract pack V3 (HUD) builds against — one source of truth for both
// build sessions. `tint` stays absent until tint.ts ships and fills it.
export interface ViewerHandle {
  setClip(name: ClipName, fade?: number): void;
  setClipSpeed(v: number): void;
  setMorph(name: string, v: number): void;
  setAutoBlink(on: boolean): void;
  setCharacter(id: CharacterId): Promise<void>;
  setHead(slot: HeadSlot): void;
  tint?: {
    applyPreset(id: string): void;
    setZoneColor(module: string, zone: number, hex: string): void;
  };
  render: {
    setBloom(on: boolean): void;
    setToneMapping(mode: ToneMode): void;
    setExposure(v: number): void;
    setAutoRotate(on: boolean): void;
  };
  camera: { reset(): void };
  info(): { fps: number; calls: number; tris: number };
  dispose(): void;
}

export interface ViewerOptions {
  reducedMotion: boolean;
  onProgress(pct: number): void;
  onReady(): void;
  onError(error: unknown): void;
}

interface CharacterRuntime {
  root: Group;
  mixer: AnimationMixer;
  actions: Partial<Record<ClipName, AnimationAction>>;
  current: ClipName;
}

const DEFAULT_SPEED = 0.7;
const CROSSFADE = 0.3;
// Mid-idle time for the reduced-motion freeze: a settled pose, never the bind pose.
const FREEZE_AT = 1.0;

export function createViewer(container: HTMLElement, opts: ViewerOptions): ViewerHandle {
  const canvas = document.createElement('canvas');
  canvas.className = 'viewer-canvas block h-full w-full';
  container.appendChild(canvas);

  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = NeutralToneMapping;
  detectSupport(renderer);

  const scene = new Scene();
  scene.background = new Color(0x101014);

  // Free PBR speculars: the procedural room baked through PMREM, zero asset bytes.
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  // V1 base light rig; the spec trio (hemisphere fill + neutral key + lilac rim)
  // lands with the scene pack.
  scene.add(new HemisphereLight(0xbfc7ff, 0x30281e, 1.2));
  const key = new DirectionalLight(0xffffff, 2.0);
  key.position.set(2, 4, 3);
  scene.add(key);

  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  const resize = () => {
    const { clientWidth, clientHeight } = container;
    if (!clientWidth || !clientHeight) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  const runtimes = new Map<CharacterId, CharacterRuntime>();
  let active: CharacterId = 'm';
  let speed = DEFAULT_SPEED;
  let disposed = false;

  // Frame the character and make this pose the one `controls.reset()` returns
  // to — captured after EVERY auto-frame, else reset restores a pre-frame void.
  const frame = (root: Group) => {
    const box = new Box3().setFromObject(root);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const d = Math.max(size.x, size.y, size.z);
    camera.position.set(center.x + d * 0.9, center.y + d * 0.25, center.z + d * 1.1);
    controls.target.copy(center);
    controls.update();
    controls.saveState();
  };

  const bootClip = (runtime: CharacterRuntime) => {
    const idle = runtime.actions.Idle;
    if (!idle) return;
    idle.play();
    if (opts.reducedMotion) {
      // The proven freeze path: a real mid-clip frame, never the bind pose.
      idle.paused = true;
      runtime.mixer.setTime(FREEZE_AT);
      runtime.mixer.update(0);
    }
  };

  const addRuntime = (id: CharacterId, gltf: Awaited<ReturnType<typeof loadCharacter>>) => {
    const mixer = new AnimationMixer(gltf.scene);
    mixer.timeScale = speed;
    const actions: CharacterRuntime['actions'] = {};
    for (const clip of gltf.animations) {
      if (clip.name === 'Idle' || clip.name === 'Walk') {
        actions[clip.name] = mixer.clipAction(clip);
      }
    }
    const runtime: CharacterRuntime = { root: gltf.scene, mixer, actions, current: 'Idle' };
    setHeadSlot(gltf, characterById(id), 'hair');
    runtimes.set(id, runtime);
    scene.add(gltf.scene);
    return runtime;
  };

  loadCharacter(active, opts.onProgress)
    .then((gltf) => {
      if (disposed) return;
      const runtime = addRuntime(active, gltf);
      frame(runtime.root);
      bootClip(runtime);
      opts.onReady();
      prefetchIdle();
    })
    .catch((error) => {
      if (!disposed) opts.onError(error);
    });

  // Warm the other character on desktop when the browser is idle and the user
  // has not asked to save data; mobile pays for F only on an explicit switch.
  const prefetchIdle = () => {
    type NavWithSaveData = Navigator & { connection?: { saveData?: boolean } };
    if ((navigator as NavWithSaveData).connection?.saveData) return;
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (typeof requestIdleCallback !== 'function') return;
    requestIdleCallback(() => {
      if (!disposed) void loadCharacter('f');
    });
  };

  const clock = new Clock();
  let fps = 0;
  let frames = 0;
  let windowStart = performance.now();
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    const runtime = runtimes.get(active);
    if (runtime) runtime.mixer.update(delta);
    controls.update();
    renderer.render(scene, camera);
    frames += 1;
    const now = performance.now();
    if (now - windowStart >= 500) {
      fps = Math.round((frames * 1000) / (now - windowStart));
      frames = 0;
      windowStart = now;
    }
  });

  return {
    setClip(name, fade = CROSSFADE) {
      const runtime = runtimes.get(active);
      if (!runtime || runtime.current === name) return;
      const from = runtime.actions[runtime.current];
      const to = runtime.actions[name];
      if (!to) return;
      to.enabled = true;
      to.paused = false;
      to.reset().play();
      from?.crossFadeTo(to, fade, false);
      runtime.current = name;
    },
    setClipSpeed(v) {
      speed = v;
      for (const runtime of runtimes.values()) runtime.mixer.timeScale = v;
    },
    setMorph(name, v) {
      const runtime = runtimes.get(active);
      runtime?.root.traverse((object) => {
        const mesh = object as unknown as {
          morphTargetDictionary?: Record<string, number>;
          morphTargetInfluences?: number[];
        };
        const index = mesh.morphTargetDictionary?.[name];
        if (index !== undefined && mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences[index] = v;
        }
      });
    },
    setAutoBlink() {
      // ponytail: the blink timer ships with the HUD pack; the toggle exists so
      // the handle contract is complete from day one.
    },
    async setCharacter(id) {
      if (id === active) return;
      const existing = runtimes.get(id);
      const runtime = existing ?? addRuntime(id, await loadCharacter(id));
      if (disposed) return;
      const previous = runtimes.get(active);
      if (previous) previous.root.visible = false;
      runtime.root.visible = true;
      active = id;
      if (!existing) bootClip(runtime);
      frame(runtime.root);
    },
    setHead(slot) {
      const runtime = runtimes.get(active);
      if (!runtime) return;
      const character = characterById(active);
      for (const [key, nodeName] of Object.entries(character.heads)) {
        const node = runtime.root.getObjectByName(nodeName);
        if (node) node.visible = key === slot;
      }
    },
    render: {
      setBloom() {
        // Composer lands with the scene pack; the flag is wired there.
      },
      setToneMapping(mode) {
        renderer.toneMapping =
          mode === 'aces'
            ? ACESFilmicToneMapping
            : mode === 'agx'
              ? AgXToneMapping
              : NeutralToneMapping;
      },
      setExposure(v) {
        renderer.toneMappingExposure = v;
      },
      setAutoRotate(on) {
        controls.autoRotate = on;
      },
    },
    camera: {
      reset() {
        controls.reset();
      },
    },
    info() {
      return { fps, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      renderer.setAnimationLoop(null);
      controls.dispose();
      // Renderer-owned GL resources die with the context; parsed scenes and
      // their texture data survive in the module cache for free re-entry.
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      for (const runtime of runtimes.values()) scene.remove(runtime.root);
    },
  };
}
