// Post pipeline: composer with a subtle bloom over the rim highlights, and an
// OutputPass that re-reads renderer.toneMapping every frame — so the tone
// mapping selector stays a plain live assign on the renderer. Dropping this
// file's import is the first byte-recovery step in the rollback map (-4.3 KB).
import { Vector2, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export interface Post {
  render(): void;
  setSize(width: number, height: number): void;
  setBloom(on: boolean): void;
  dispose(): void;
}

export function createPost(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera): Post {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Threshold keeps bloom on the bright rim/speculars only; the character's
  // mid-tones must stay crisp — this is telemetry, not a music video.
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.3, 0.5, 0.85);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {
    render: () => composer.render(),
    setSize: (width, height) => composer.setSize(width, height),
    setBloom: (on) => {
      bloom.enabled = on;
    },
    dispose: () => composer.dispose(),
  };
}
