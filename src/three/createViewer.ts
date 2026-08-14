// The viewer runtime: renderer, scene, camera, controls, load/animate/dispose.
// Everything here lives behind the /3d dynamic import; the only consumer-facing
// surface is ViewerHandle, which reaches eager files as `import type` only.
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  AnimationMixer,
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  NeutralToneMapping,
  PMREMGenerator,
  PerspectiveCamera,
  Scene,
  Timer,
  Vector3,
  WebGLRenderer,
  type AnimationAction,
  type Group,
  type Mesh,
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
import { createFloor } from './grid';
import { createPost } from './post';
import { applyPreset, resetTint, setZoneColor, wireCharacter } from './tint';

export type ClipName = 'Idle' | 'Walk';
export type ToneMode = 'neutral' | 'aces' | 'agx';

// The contract pack V3 (HUD) builds against — one source of truth for both
// build sessions.
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
  /** Morph-carrying meshes, collected once at load: the blink timer writes every
      frame, and a scene traversal per write is a cost nobody asked for. */
  morphMeshes: Mesh[];
}

const DEFAULT_SPEED = 0.7;
const CROSSFADE = 0.3;
// Mid-idle time for the reduced-motion freeze: a settled pose, never the bind pose.
const FREEZE_AT = 1.0;
// One blink, eyes shut and open again. Seconds, like everything on the loop clock.
const BLINK_SECONDS = 0.18;

/** Triangle 0→1→0 across one blink; anything outside the window is eyes open. */
export function blinkValue(tSinceStart: number): number {
  if (tSinceStart <= 0 || tSinceStart >= BLINK_SECONDS) return 0;
  const half = BLINK_SECONDS / 2;
  return tSinceStart < half ? tSinceStart / half : (BLINK_SECONDS - tSinceStart) / half;
}

/** Maps a `Math.random()` draw onto the spec's 2–6 s idle period between blinks. */
export function nextBlinkDelay(rand: number): number {
  return 2 + rand * 4;
}

// Both the sliders and the blink timer write through here — the meshes are
// cached on the runtime, so neither walks the graph.
function writeMorph(runtime: CharacterRuntime, name: string, v: number): void {
  for (const mesh of runtime.morphMeshes) {
    const index = mesh.morphTargetDictionary?.[name];
    const influences = mesh.morphTargetInfluences;
    if (index !== undefined && influences) influences[index] = v;
  }
}

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

  // The spec light trio: cool hemisphere fill, neutral key from front-top,
  // lilac rim from behind so the silhouette reads against the dark bay.
  scene.add(new HemisphereLight(0x8890b0, 0x1a1620, 0.9));
  const key = new DirectionalLight(0xffffff, 1.8);
  key.position.set(1.5, 3, 2.5);
  scene.add(key);
  const rim = new DirectionalLight(0xb497cf, 2.4);
  rim.position.set(-1.5, 2.2, -2.5);
  scene.add(rim);

  scene.add(createFloor());

  const camera = new PerspectiveCamera(45, 1, 0.1, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  // The character must always stay framed: no pan drift, no diving under the
  // floor, no zooming inside the mesh. Distances calibrate to a ~1.8 m model.
  controls.enablePan = false;
  controls.minDistance = 1.0;
  controls.maxDistance = 5.0;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = 1.55;

  // r185 OrbitControls has no double-click handling — hand-rolled reset, with a
  // manual double-tap window for coarse pointers.
  let lastTap = 0;
  const onDblClick = () => controls.reset();
  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    const now = performance.now();
    if (now - lastTap < 300) controls.reset();
    lastTap = now;
  };
  canvas.addEventListener('dblclick', onDblClick);
  canvas.addEventListener('pointerup', onPointerUp);

  const post = createPost(renderer, scene, camera);

  const resize = () => {
    const { clientWidth, clientHeight } = container;
    if (!clientWidth || !clientHeight) return;
    // Re-read the ratio: it changes when the window crosses monitors.
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(clientWidth, clientHeight, false);
    post.setSize(clientWidth, clientHeight);
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

  // Tint state outlives the viewer with the material cache; the HUD does not.
  // A fresh mount boots at factory, so the outfit resets to match it.
  resetTint();

  // Auto-blink rides the render loop's own clock instead of an interval: a
  // backgrounded tab freezes rAF, so no blinks pile up behind an unwatched
  // deadline. Closure state, so nothing leaks between mounts.
  let autoBlink = !opts.reducedMotion;
  let blinkClock = 0;
  let blinkAt = nextBlinkDelay(Math.random());
  let blinkFrom = -1; // < 0 = eyes open

  // Frame the character and make this pose the one `controls.reset()` returns
  // to — captured after EVERY auto-frame, else reset restores a pre-frame void.
  const frame = (root: Group) => {
    const box = new Box3().setFromObject(root);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const d = Math.max(size.x, size.y, size.z);
    camera.position.set(center.x + d * 0.9, center.y + d * 0.25, center.z + d * 1.1);
    // Target the chest, not the bbox center: heads read better slightly high.
    controls.target.set(center.x, center.y + size.y * 0.1, center.z);
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
    const morphMeshes: Mesh[] = [];
    gltf.scene.traverse((object) => {
      const mesh = object as Mesh;
      if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) morphMeshes.push(mesh);
    });
    // Cached scenes keep their last visit's morph influences; the HUD boots at
    // zero, so the face must too (the head slot resets the same way below).
    for (const mesh of morphMeshes) mesh.morphTargetInfluences?.fill(0);
    const runtime: CharacterRuntime = {
      root: gltf.scene,
      mixer,
      actions,
      current: 'Idle',
      morphMeshes,
    };
    setHeadSlot(gltf, characterById(id), 'hair');
    // Idempotent by design: the cached scene brings back materials that may
    // already own their tint uniforms from an earlier visit.
    wireCharacter(gltf.scene);
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

  // r185 deprecated Clock; Timer is the console-clean replacement.
  const timer = new Timer();
  // With a composer, autoReset makes renderer.info reflect only the LAST pass
  // (the output quad: 1 call, 2 tris). Manual reset per frame accumulates the
  // real numbers — what the GPU actually does, every pass included.
  renderer.info.autoReset = false;
  let fps = 0;
  let frames = 0;
  let windowStart = performance.now();
  renderer.setAnimationLoop(() => {
    timer.update();
    const delta = timer.getDelta();
    const runtime = runtimes.get(active);
    if (runtime) {
      runtime.mixer.update(delta);
      blinkClock += delta;
      if (blinkFrom >= 0) {
        // Always ride the ramp to its end: a toggle flipped mid-blink must not
        // leave the lids frozen half-closed.
        const t = blinkClock - blinkFrom;
        writeMorph(runtime, 'Blink', blinkValue(t));
        if (t >= BLINK_SECONDS) blinkFrom = -1;
      } else if (blinkClock >= blinkAt) {
        // Rescheduled even while off, so re-enabling never fires a stale blink.
        blinkAt = blinkClock + nextBlinkDelay(Math.random());
        if (autoBlink) blinkFrom = blinkClock;
      }
    }
    controls.update();
    renderer.info.reset();
    post.render();
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
      if (runtime) writeMorph(runtime, name, v);
    },
    setAutoBlink(on) {
      // Reduced motion wins: the toggle can switch blinking off, never back on.
      autoBlink = on && !opts.reducedMotion;
    },
    async setCharacter(id) {
      if (id === active) return;
      const existing = runtimes.get(id);
      const runtime = existing ?? addRuntime(id, await loadCharacter(id));
      if (disposed) return;
      const previous = runtimes.get(active);
      if (previous) {
        previous.root.visible = false;
        // A switch mid-blink would strand the old character's lids half-closed
        // until it is next active AND next blinks — open them on the way out.
        writeMorph(previous, 'Blink', 0);
      }
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
    // Module-scope in tint.ts, like the parsed scenes it patches — the handle
    // is just the HUD's door to it.
    tint: { applyPreset, setZoneColor },
    render: {
      setBloom(on) {
        post.setBloom(on);
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
      canvas.removeEventListener('dblclick', onDblClick);
      canvas.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      post.dispose();
      // Renderer-owned GL resources die with the context; parsed scenes and
      // their texture data survive in the module cache for free re-entry.
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      for (const runtime of runtimes.values()) scene.remove(runtime.root);
    },
  };
}
