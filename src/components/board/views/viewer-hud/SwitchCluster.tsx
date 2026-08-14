// Who stands on the pad, and which head they wear. The M/F labels come from the
// registry and Hair/Mask are latin literals — rig vocabulary, like the clip
// names, not copy. This is the one cluster whose control can wait on the
// network: the second character's GLB may still be streaming, and its progress
// arrives through the loader's own subscription, never through ViewerHandle —
// setCharacter() stays progress-free by design.
import type { Dispatch } from 'react';
import { useT } from '../../../../i18n/I18nContext';
import {
  CHARACTERS,
  onCharacterProgress,
  type CharacterId,
  type HeadSlot,
} from '../../../../three/characters';
import type { ViewerHandle } from '../../../../three/createViewer';
import type { HudAction, HudState } from './hudState';
import { segClass } from './seg';

const HEADS: [HeadSlot, string][] = [
  ['hair', 'Hair'],
  ['mask', 'Mask'],
];

export default function SwitchCluster({
  hud,
  dispatch,
  viewer,
}: {
  hud: HudState;
  dispatch: Dispatch<HudAction>;
  viewer: ViewerHandle;
}) {
  const t = useT();

  const switchTo = async (id: CharacterId) => {
    // One switch at a time: a second click mid-stream would race the head
    // re-apply below and leave the panel describing a pad it lost track of.
    if (id === hud.character || hud.charProgress !== null) return;
    const off = onCharacterProgress(id, (pct) => dispatch({ type: 'setCharProgress', value: pct }));
    try {
      await viewer.setCharacter(id);
      dispatch({ type: 'setCharacter', value: id });
      // A character loaded earlier kept whatever head it wore last; the panel is
      // the truth, so the current slot is re-applied on every arrival.
      viewer.setHead(hud.head);
    } catch {
      // A failed stream leaves the pad on whoever is already standing on it: the
      // segment simply never moves, which is the whole report we can give
      // without inventing copy for it.
    } finally {
      off();
      dispatch({ type: 'setCharProgress', value: null });
    }
  };

  return (
    <>
      <section className="space-y-2 border-t border-dashed border-neutral-800 pt-3 first:border-0 first:pt-0">
        <h3 className="text-[10px] tracking-widest text-neutral-500 uppercase">
          {t('threed.character')}
        </h3>
        <div role="group" aria-label={t('threed.character')} className="flex">
          {CHARACTERS.map((character, i) => (
            <button
              key={character.id}
              type="button"
              aria-pressed={hud.character === character.id}
              onClick={() => void switchTo(character.id)}
              className={segClass(hud.character === character.id, i === 0 ? 'l' : 'r')}
            >
              {character.label}
            </button>
          ))}
        </div>
        {hud.charProgress !== null && (
          // Numbers as sibling DOM nodes: the caption stays static and the
          // ${var} interpolation whitelist stays untouched.
          <p className="text-neutral-500">
            {t('threed.loading')} {hud.charProgress}%
          </p>
        )}
      </section>
      <section className="space-y-2 border-t border-dashed border-neutral-800 pt-3">
        <h3 className="text-[10px] tracking-widest text-neutral-500 uppercase">
          {t('threed.head')}
        </h3>
        <div role="group" aria-label={t('threed.head')} className="flex">
          {HEADS.map(([slot, label], i) => (
            <button
              key={slot}
              type="button"
              aria-pressed={hud.head === slot}
              onClick={() => {
                viewer.setHead(slot);
                dispatch({ type: 'setHead', value: slot });
              }}
              className={segClass(hud.head === slot, i === 0 ? 'l' : 'r')}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
