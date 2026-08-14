// Face controls. Blink is missing from the sliders on purpose — the auto-blink
// timer owns that morph, and the toggle here is the only thing that touches it.
import type { Dispatch } from 'react';
import { useT } from '../../../../i18n/I18nContext';
import type { ViewerHandle } from '../../../../three/createViewer';
import type { HudAction, HudState, MorphName } from './hudState';

// Order is pinned: the rig's morph names paired with their captions.
const MORPHS: [MorphName, string][] = [
  ['Smile', 'threed.morphSmile'],
  ['Angry', 'threed.morphAngry'],
  ['ElfEars_02', 'threed.morphEars'],
];

export default function MorphCluster({
  hud,
  dispatch,
  viewer,
}: {
  hud: HudState;
  dispatch: Dispatch<HudAction>;
  viewer: ViewerHandle;
}) {
  const t = useT();
  // ponytail: read per render like VaiShell, not subscribed — an OS toggle mid
  // session applies on the next paint, and the viewer enforces it regardless.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const blinking = hud.autoBlink && !reduced;

  return (
    <section className="space-y-2 border-t border-dashed border-neutral-800 pt-3 first:border-0 first:pt-0">
      <h3 className="text-[10px] tracking-widest text-neutral-500 uppercase">
        {t('threed.morphs')}
      </h3>
      {MORPHS.map(([name, key]) => (
        <label key={name} className="block">
          <span className="text-neutral-400">{t(key)}</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={hud.morphs[name]}
            aria-label={t(key)}
            onChange={(event) => {
              const value = event.target.valueAsNumber;
              viewer.setMorph(name, value);
              dispatch({ type: 'setMorph', name, value });
            }}
            className="cursor-target w-full accent-accent"
          />
        </label>
      ))}
      <button
        type="button"
        aria-pressed={blinking}
        disabled={reduced}
        onClick={() => {
          viewer.setAutoBlink(!hud.autoBlink);
          dispatch({ type: 'setAutoBlink', value: !hud.autoBlink });
        }}
        className={`cursor-target rounded border border-dashed px-2 py-0.5 disabled:opacity-40 ${
          blinking
            ? 'border-accent/60 text-accent'
            : 'border-neutral-700 text-neutral-500 hover:text-neutral-300'
        }`}
      >
        {t('threed.blink')}
      </button>
    </section>
  );
}
