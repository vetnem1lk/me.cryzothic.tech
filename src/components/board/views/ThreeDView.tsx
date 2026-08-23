// The engine bay gate: a flat telemetry frame that boots the real G2 viewer.
// The three.js island loads on demand behind the lazy() below; this gate must
// stay three-free — one value import from 'three' here would hoist the whole
// runtime into the Board chunk every visitor pays for.
import { Suspense, lazy, useState } from 'react';
import { useT } from '../../../i18n/I18nContext';

const loadViewer = () => import('./ThreeDViewer');
const ThreeDViewer = lazy(loadViewer);

// The /3d doors (nav tab, VAI chip, briefing card, command row) warm the chunk
// on intent: fetching + evaluating three.js on hover/focus/pointerdown moves
// its main-thread cost off the click path — the measured freeze was module
// eval + viewer init landing right after navigation, not a suppressed
// fallback. The GLB stays untouched: only real navigation starts the stream.
// eslint-disable-next-line react/only-export-components
export const warmViewer = () => {
  void loadViewer();
};
// eslint-disable-next-line react/only-export-components
export const preload3d = {
  onPointerEnter: warmViewer,
  onFocus: warmViewer,
  onPointerDown: warmViewer,
};

// Hand-rolled WebGL2 probe on a throwaway canvas: synchronous, no library.
// r185 renders exclusively through WebGL2, so webgl2 is the only context that
// answers the question.
function webgl2Available(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

// Not a .cursor-target itself: the interactive surface is the canvas inside.
export default function ThreeDView() {
  const t = useT();
  // Probed once per mount, not per render — context creation is not free.
  const [supported] = useState(webgl2Available);

  return (
    <section className="flex h-full flex-col gap-2 p-3 md:p-4">
      {/* Heading block, not chrome: mode line then credit, both above the bezel.
          Strapped to the frame's bottom edge the credit ate a band of canvas at
          every width; up here the canvas runs edge to edge inside the border. */}
      <div className="text-center">
        <h2 className="font-mono text-sm tracking-widest text-neutral-400 uppercase">
          {t('threed.mode')}
        </h2>
        {/* No measure cap: max-w-prose resolved to 429px at this size and wrapped the
            RU credit to two lines at every desktop width. Uncapped it takes one line
            wherever the stage is wide enough and wraps naturally where it is not. */}
        <p className="font-mono text-[11px] leading-snug text-neutral-500">
          {t('threed.credit')}
        </p>
      </div>
      <div className="relative h-[65dvh] min-h-[320px] overflow-hidden border border-dashed border-accent/50 md:h-auto md:min-h-0 md:flex-1">
        {supported ? (
          <Suspense
            fallback={
              <p className="absolute inset-0 grid place-items-center font-mono text-sm tracking-widest text-neutral-500 uppercase">
                {t('threed.boot')}
              </p>
            }
          >
            <ThreeDViewer />
          </Suspense>
        ) : (
          <p className="absolute inset-0 grid place-items-center p-6 text-center text-base text-neutral-400">
            {t('threed.note')}
          </p>
        )}
      </div>
    </section>
  );
}
