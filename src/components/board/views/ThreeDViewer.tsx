// The island root behind the ThreeDView gate: everything three.js lives on
// this side of the dynamic import. Owns the canvas mount, the StrictMode
// double-mount guard and the full teardown; the parsed-GLTF cache survives at
// module scope in src/three, so leaving and returning re-enters for free.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n/I18nContext';
import { createViewer, type ViewerHandle } from '../../../three/createViewer';
import FpsOverlay, { type ViewerStats } from './viewer-hud/FpsOverlay';

type Phase = 'loading' | 'ready' | 'error';

export default function ThreeDViewer() {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ViewerHandle | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [pct, setPct] = useState(0);

  const readStats = useCallback(
    (): ViewerStats => viewerRef.current?.info() ?? { fps: 0, calls: 0, tris: 0 },
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // StrictMode runs setup/cleanup/setup: the flag stops the first mount's
    // async ready path from touching state after its viewer is disposed.
    let cancelled = false;
    const viewer = createViewer(host, {
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      onProgress: (value) => {
        if (!cancelled) setPct(value);
      },
      onReady: () => {
        if (!cancelled) setPhase('ready');
      },
      onError: () => {
        if (!cancelled) setPhase('error');
      },
    });
    viewerRef.current = viewer;
    return () => {
      cancelled = true;
      viewerRef.current = null;
      viewer.dispose();
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={hostRef} className="h-full w-full" aria-label={t('threed.mode')} role="img" />
      {phase === 'ready' && <FpsOverlay read={readStats} />}
      {phase === 'loading' && (
        <p className="pointer-events-none absolute inset-0 grid place-items-center font-mono text-sm tracking-widest text-neutral-500 uppercase">
          {/* Numbers as sibling DOM nodes: the copy stays static, the ${var}
              interpolation whitelist stays untouched. */}
          {t('threed.loading')} {pct}%
        </p>
      )}
      {phase === 'error' && (
        <p className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center text-base text-neutral-400">
          {t('threed.error')}
        </p>
      )}
    </div>
  );
}
