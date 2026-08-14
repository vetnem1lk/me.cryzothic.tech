// Which clip plays, and how fast. `Idle`/`Walk` stay latin literals: they are
// the rig's own clip names — shell fiction, like the M/F tokens — not copy.
// Every control mirrors the viewer first and the state atom second, so a
// dropped dispatch can never leave the panel claiming a pose the rig is not in.
import type { Dispatch } from 'react';
import { useT } from '../../../../i18n/I18nContext';
import type { ClipName, ViewerHandle } from '../../../../three/createViewer';
import type { HudAction, HudState } from './hudState';
import { segClass } from './seg';

const CLIPS: ClipName[] = ['Idle', 'Walk'];

export default function ClipCluster({
  hud,
  dispatch,
  viewer,
}: {
  hud: HudState;
  dispatch: Dispatch<HudAction>;
  viewer: ViewerHandle;
}) {
  const t = useT();

  return (
    <section className="space-y-2 border-t border-dashed border-neutral-800 pt-2 first:border-0 first:pt-0">
      {/* Header rides the same row as its pill — see CharacterCluster. */}
      <div className="sticky top-[41px] z-10 bg-neutral-950/95 md:static md:bg-transparent flex items-center justify-between gap-2">
        <h3 className="text-[10px] tracking-widest text-neutral-500 uppercase">
          {t('threed.clips')}
        </h3>
        <div role="group" aria-label={t('threed.clips')} className="flex">
          {CLIPS.map((name, i) => (
            <button
              key={name}
              type="button"
              aria-pressed={hud.clip === name}
              onClick={() => {
                viewer.setClip(name);
                dispatch({ type: 'setClip', value: name });
              }}
              className={segClass(hud.clip === name, i === 0 ? 'l' : 'r')}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      {/* aria-label, not the wrapped text: the caption carries a live number and
          an accessible name that changes on every drag is no name at all. */}
      <label className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-neutral-400">{t('threed.speed')}</span>
        <input
          type="range"
          min="0.25"
          max="1.5"
          step="0.05"
          value={hud.speed}
          aria-label={t('threed.speed')}
          onChange={(event) => {
            const value = event.target.valueAsNumber;
            viewer.setClipSpeed(value);
            dispatch({ type: 'setSpeed', value });
          }}
          className="cursor-target h-8 min-w-0 flex-1 accent-accent md:h-4"
        />
        <span className="w-10 shrink-0 text-right tabular-nums">{hud.speed.toFixed(2)}×</span>
      </label>
    </section>
  );
}
