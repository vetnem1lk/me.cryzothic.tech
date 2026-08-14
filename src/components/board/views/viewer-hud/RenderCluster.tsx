// How the frame is graded: tone curve, exposure, bloom — plus the turntable,
// which lives here because it is the last thing that moves on its own. The tone
// tokens stay latin literals like the clip names: they are engine vocabulary,
// not copy. No camera-reset button on purpose — the reset gesture is a
// double-click on the canvas (C3-5), and a button for it would be a second
// truth. Every control mirrors the viewer first, the state atom second.
import type { Dispatch } from 'react';
import { useT } from '../../../../i18n/I18nContext';
import type { ToneMode, ViewerHandle } from '../../../../three/createViewer';
import type { HudAction, HudState } from './hudState';
import { chipClass, segClass } from './seg';

const TONES: ToneMode[] = ['neutral', 'aces', 'agx'];

export default function RenderCluster({
  hud,
  dispatch,
  viewer,
}: {
  hud: HudState;
  dispatch: Dispatch<HudAction>;
  viewer: ViewerHandle;
}) {
  const t = useT();
  // ponytail: read per render like MorphCluster — createViewer does NOT gate
  // autoRotate itself, so this is the only thing standing between the reduced
  // motion policy and a turntable that never stops.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rotating = hud.autoRotate && !reduced;

  return (
    <section className="space-y-2 border-t border-dashed border-neutral-800 pt-2 first:border-0 first:pt-0">
      <h3 className="text-[10px] tracking-widest text-neutral-500 uppercase">
        {t('threed.render')}
      </h3>
      {/* The trio's own labels are engine tokens: nothing on the row says what
          they grade, so it gets a visible caption. The group keeps its
          aria-label — that is what a screen reader announces. */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-neutral-400">{t('threed.tone')}</span>
        <div role="group" aria-label={t('threed.tone')} className="flex">
          {TONES.map((mode, i) => (
            <button
              key={mode}
              type="button"
              aria-pressed={hud.tone === mode}
              onClick={() => {
                viewer.render.setToneMapping(mode);
                dispatch({ type: 'setTone', value: mode });
              }}
              className={`${segClass(
                hud.tone === mode,
                i === 0 ? 'l' : i === TONES.length - 1 ? 'r' : 'm',
              )} uppercase`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>
      {/* aria-label, not the wrapped text: the caption carries a live number and
          an accessible name that changes on every drag is no name at all. */}
      <label className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-neutral-400">{t('threed.exposure')}</span>
        <input
          type="range"
          min="0.5"
          max="1.6"
          step="0.05"
          value={hud.exposure}
          aria-label={t('threed.exposure')}
          onChange={(event) => {
            const value = event.target.valueAsNumber;
            viewer.render.setExposure(value);
            dispatch({ type: 'setExposure', value });
          }}
          className="cursor-target min-w-0 flex-1 accent-accent"
        />
        <span className="w-10 shrink-0 text-right tabular-nums">{hud.exposure.toFixed(2)}</span>
      </label>
      <div className="flex gap-1">
        <button
          type="button"
          aria-pressed={hud.bloom}
          onClick={() => {
            viewer.render.setBloom(!hud.bloom);
            dispatch({ type: 'setBloom', value: !hud.bloom });
          }}
          className={chipClass(hud.bloom)}
        >
          {t('threed.bloom')}
        </button>
        <button
          type="button"
          aria-pressed={rotating}
          disabled={reduced}
          onClick={() => {
            viewer.render.setAutoRotate(!hud.autoRotate);
            dispatch({ type: 'setAutoRotate', value: !hud.autoRotate });
          }}
          className={`${chipClass(rotating)} disabled:opacity-40`}
        >
          {t('threed.rotate')}
        </button>
      </div>
    </section>
  );
}
