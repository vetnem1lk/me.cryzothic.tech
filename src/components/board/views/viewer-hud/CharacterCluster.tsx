// Who stands on the pad. The M/F labels come from the registry. This is the one
// cluster whose control can wait on the network: the second character's GLB may
// still be streaming, and its progress arrives through the loader's own
// subscription, never through ViewerHandle — setCharacter() stays progress-free
// by design.
import type { Dispatch } from 'react';
import { useT } from '../../../../i18n/I18nContext';
import { viewCharacter } from '../../story';
import { CHARACTERS, onCharacterProgress, type CharacterId } from '../../../../three/characters';
import type { ViewerHandle } from '../../../../three/createViewer';
import { applyHudToViewer, type HudAction, type HudState } from './hudState';
import { segClass } from './seg';

export default function CharacterCluster({
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
      // The switch door of the FILE-03 pair: only a completed stream counts —
      // the catch below never marks a pad nobody saw.
      viewCharacter(id);
      // The panel is the truth and it did not move: the character who just
      // walked on gets the clip, the face, the head and the hair it describes.
      applyHudToViewer(viewer, hud);
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
    <section className="space-y-2 border-t border-dashed border-neutral-800 pt-2 first:border-0 first:pt-0">
      {/* Header and control share one row: a two-segment pill leaves half the
          panel width empty beside it, and the label is what fills it. */}
      <div className="sticky top-[51px] z-10 bg-neutral-950/95 md:static md:bg-transparent flex items-center justify-between gap-2">
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
      </div>
      {hud.charProgress !== null && (
        // Numbers as sibling DOM nodes: the caption stays static and the
        // ${var} interpolation whitelist stays untouched.
        <p aria-live="polite" className="text-neutral-500">
          {t('threed.loading')} {hud.charProgress}%
        </p>
      )}
    </section>
  );
}
