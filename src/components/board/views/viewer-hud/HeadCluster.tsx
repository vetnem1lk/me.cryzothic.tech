// What the character wears above the neck. Hair and mask are INDEPENDENT chips,
// not a segmented pair: the rig was authored so a mask sits over hair, and both
// off is a legal bald head rather than a state to defend against. The swatch
// below them is the one hair zone the mask actually carries — its G and B
// channels decode to zero, so a second and third picker would be dead controls.
import { useEffect, type Dispatch } from 'react';
import { useT } from '../../../../i18n/I18nContext';
import type { HeadSlot } from '../../../../three/characters';
import type { ViewerHandle } from '../../../../three/createViewer';
import type { HudAction, HudState } from './hudState';
import { chipClass } from './seg';

// Head vocabulary is copy, not rig names: `headMask` is its own key on purpose —
// `threed.mod.mask` belongs to the outfit module list and would drift with it.
const SLOTS: [HeadSlot, string][] = [
  ['hair', 'threed.hair'],
  ['mask', 'threed.headMask'],
];

export default function HeadCluster({
  hud,
  dispatch,
  viewer,
}: {
  hud: HudState;
  dispatch: Dispatch<HudAction>;
  viewer: ViewerHandle;
}) {
  const t = useT();
  // The rig is mirrored from the reduced flags, never from the click: two chips
  // tapped inside one tick each built `{...hud.head, [slot]: value}` from the
  // same stale props, so the second setHead un-did the first while the reducer
  // kept both. Mirroring the pair the reducer settled on makes the panel and the
  // head agree by construction — and stays quiet on a character switch, where the
  // flags do not move and applyHudToViewer is what re-dresses the arrival.
  useEffect(() => {
    viewer.setHead(hud.head);
  }, [viewer, hud.head]);

  return (
    <section className="space-y-2 border-t border-dashed border-neutral-800 pt-2 first:border-0 first:pt-0">
      {/* Header rides the same row as its chips — see CharacterCluster. */}
      <div className="sticky top-[51px] z-10 bg-neutral-950/95 md:static md:bg-transparent flex items-center justify-between gap-2">
        <h3 className="text-[10px] tracking-widest text-neutral-500 uppercase">
          {t('threed.head')}
        </h3>
        <div role="group" aria-label={t('threed.head')} className="flex gap-1">
          {SLOTS.map(([slot, key]) => (
            <button
              key={slot}
              type="button"
              aria-pressed={hud.head[slot]}
              onClick={() => dispatch({ type: 'setHead', slot, value: !hud.head[slot] })}
              className={chipClass(hud.head[slot])}
            >
              {t(key)}
            </button>
          ))}
        </div>
      </div>
      {/* One control, one dispatch per event: the swatch has no sibling to race,
          so it mirrors inline like the rest of the panel. */}
      <label className="flex items-center justify-between gap-2">
        <span className="text-neutral-400">{t('threed.hairColor')}</span>
        <input
          type="color"
          value={hud.hairColor}
          disabled={!hud.head.hair}
          onChange={(event) => {
            const hex = event.target.value;
            viewer.tint?.setZoneColor('hair', 0, hex);
            dispatch({ type: 'setHairColor', value: hex });
          }}
          className="cursor-target h-8 w-12 border border-dashed border-neutral-700 bg-transparent disabled:opacity-40 md:h-5 md:w-10"
        />
      </label>
    </section>
  );
}
