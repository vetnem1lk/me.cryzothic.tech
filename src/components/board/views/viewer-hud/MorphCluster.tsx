// Face controls. Blink is missing from the sliders on purpose — the auto-blink
// timer owns that morph, and the toggle here is the only thing that touches it.
import type { Dispatch } from 'react';
import { useT } from '../../../../i18n/I18nContext';
import type { ViewerHandle } from '../../../../three/createViewer';
import type { HudAction, HudState, MorphName } from './hudState';
import { chipClass } from './seg';

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
    <section className="space-y-2 border-t border-dashed border-neutral-800 pt-2 first:border-0 first:pt-0">
      {/* The header row carries the blink chip: it is the fourth face control
          and a line of its own bought nothing but height. */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] tracking-widest text-neutral-500 uppercase">
          {t('threed.morphs')}
        </h3>
        <button
          type="button"
          aria-pressed={blinking}
          disabled={reduced}
          onClick={() => {
            viewer.setAutoBlink(!hud.autoBlink);
            dispatch({ type: 'setAutoBlink', value: !hud.autoBlink });
          }}
          className={`${chipClass(blinking)} disabled:opacity-40`}
        >
          {t('threed.blink')}
        </button>
      </div>
      {MORPHS.map(([name, key]) => (
        <label key={name} className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-neutral-400">{t(key)}</span>
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
            className="cursor-target min-w-0 flex-1 accent-accent"
          />
        </label>
      ))}
    </section>
  );
}
