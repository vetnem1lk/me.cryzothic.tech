// The engine bay gate: a flat telemetry frame that boots the real G2 viewer.
// The three.js island loads on demand behind the lazy() below; this gate must
// stay three-free — one value import from 'three' here would hoist the whole
// runtime into the Board chunk every visitor pays for.
import { Suspense, lazy, useState } from 'react';
import { useT } from '../../../i18n/I18nContext';

const ThreeDViewer = lazy(() => import('./ThreeDViewer'));

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
    <section className="flex h-full flex-col gap-3 p-4 md:p-6">
      <div className="relative h-[65dvh] min-h-[320px] overflow-hidden border border-dashed border-accent/50 md:h-auto md:min-h-0 md:flex-1">
        {/* Pre-rendered still of the real scene. The live canvas mounts on top
            and simply covers it — poster-under-boot needs no state at all. */}
        <img
          src="/posters/3d-m-idle-v1.avif"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
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
        <p className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-3 py-1.5 text-center font-mono text-[11px] leading-snug text-neutral-500">
          {t('threed.credit')}
        </p>
      </div>
      <p className="text-center font-mono text-sm tracking-widest text-neutral-400 uppercase">
        {t('threed.mode')}
      </p>
    </section>
  );
}
