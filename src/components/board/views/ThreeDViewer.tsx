// The island root behind the ThreeDView gate: everything three.js lives on
// this side of the dynamic import. Owns the canvas mount, the StrictMode
// double-mount guard and the full teardown; the parsed-GLTF cache survives at
// module scope in src/three, so leaving and returning re-enters for free.
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useT } from '../../../i18n/I18nContext';
import { createViewer, type ViewerHandle } from '../../../three/createViewer';
import ClipCluster from './viewer-hud/ClipCluster';
import FpsOverlay, { type ViewerStats } from './viewer-hud/FpsOverlay';
import HudShell from './viewer-hud/HudShell';
import MorphCluster from './viewer-hud/MorphCluster';
import SwitchCluster from './viewer-hud/SwitchCluster';
import TintCluster from './viewer-hud/TintCluster';
import { HUD_DEFAULTS, hudReducer } from './viewer-hud/hudState';

type Phase = 'loading' | 'ready' | 'error';

export default function ThreeDViewer() {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ViewerHandle | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [pct, setPct] = useState(0);
  // The HUD's state lives here, not in the shell: every cluster reads one atom
  // and the viewer handle is mirrored from a single place.
  const [hud, dispatch] = useReducer(hudReducer, HUD_DEFAULTS);

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
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The viewer boots with auto-blink suppressed under reduced motion; the
    // panel has to say so, or it advertises a toggle that is already off.
    if (reducedMotion) dispatch({ type: 'setAutoBlink', value: false });
    const viewer = createViewer(host, {
      reducedMotion,
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
    // The same debug surface the pipeline's smoke viewer exposed: drives the
    // e2e sweeps (draw-call pinning per state) and costs one property.
    (window as Window & { __g2?: ViewerHandle }).__g2 = viewer;
    return () => {
      cancelled = true;
      viewerRef.current = null;
      delete (window as Window & { __g2?: ViewerHandle }).__g2;
      viewer.dispose();
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div ref={hostRef} className="h-full w-full" aria-label={t('threed.mode')} role="img" />
      {/* The ref is set before the ready phase ever flips, and the phase change
          is what re-renders — so the clusters take a live handle, not a `!`. */}
      {phase === 'ready' && viewerRef.current && (
        <>
          <FpsOverlay read={readStats} />
          <HudShell open={hud.sheetOpen} onToggle={() => dispatch({ type: 'toggleSheet' })}>
            <ClipCluster hud={hud} dispatch={dispatch} viewer={viewerRef.current} />
            <MorphCluster hud={hud} dispatch={dispatch} viewer={viewerRef.current} />
            <SwitchCluster hud={hud} dispatch={dispatch} viewer={viewerRef.current} />
            <TintCluster hud={hud} dispatch={dispatch} viewer={viewerRef.current} />
          </HudShell>
        </>
      )}
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
