// The overlay chrome every control cluster mounts inside: a floating column on
// the frame's right edge, folded into a drawer behind a toggle on phones.
// One panel node, two layouts — the clusters render once, so nothing has to be
// kept in sync between a desktop copy and a mobile one.
//
// The wrapper stays pointer-transparent on purpose: the canvas underneath is
// the orbit surface, and only the panel and its button may swallow a drag.
import type { ReactNode } from 'react';
import { useT } from '../../../../i18n/I18nContext';

const PANEL_ID = 'viewer-hud-panel';

// One skin, two seats: the floating toggle and the drawer's close button are
// the same control at opposite ends of the same state, so they wear one string.
// min-h-11 rides the skin, not one seat: both are thumb targets, and the 44px
// floor belongs wherever this class lands rather than to whoever remembers it.
const TOGGLE =
  'cursor-target pointer-events-auto min-h-11 rounded-md border border-dashed border-accent/60 bg-neutral-950/90 px-3 py-2 font-mono text-xs text-accent hover:border-accent';

export default function HudShell({
  children,
  open,
  onToggle,
}: {
  children: ReactNode;
  open: boolean;
  onToggle(): void;
}) {
  const t = useT();

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* Phones get VaiShell's drawer, not a sheet glued to the frame: fixed to
          the viewport, inset from both edges, and lifted clear of the seat the
          VAI button occupies at the bottom of every route. overscroll-contain
          keeps a flick at the end of the scroller off the page behind it. */}
      <div
        id={PANEL_ID}
        // select-none on the root, not per caption: every label here is chrome, and a
        // drag that starts on one is an orbit gesture the browser turned into a text
        // selection.
        className={`pointer-events-auto touch-manipulation space-y-1.5 overflow-y-auto select-none overscroll-contain border border-dashed border-accent/40 bg-neutral-950/70 p-2 font-mono text-xs text-neutral-300 backdrop-blur-sm max-md:fixed max-md:inset-x-2 max-md:bottom-16 max-md:z-50 max-md:max-h-[70dvh] max-md:rounded-lg max-md:border-accent/50 max-md:bg-neutral-950/95 max-md:backdrop-blur md:absolute md:top-2 md:right-2 md:block md:max-h-[calc(100%-1rem)] md:w-60 ${
          open ? '' : 'hidden'
        }`}
      >
        {/* The drawer carries its own close: on phones the floating toggle is
            gone while the panel is up, so the way out has to ride the panel. */}
        {/* z-20, not z-10: the cluster headings stick too, and a heading being
            pushed out by its own section has to slide UNDER this row, not over
            it — same layer plus later DOM order would put it on top. */}
        <div className="sticky top-0 z-20 -mx-2 mb-1.5 flex items-center justify-between border-b border-dashed border-neutral-800 bg-neutral-950/95 px-2 pb-1.5 md:hidden">
          <span className="tracking-widest text-neutral-500 uppercase">{t('threed.hud')}</span>
          <button type="button" onClick={onToggle} className={TOGGLE}>
            {t('threed.close')}
          </button>
        </div>
        {children}
      </div>
      {/* Only while the drawer is down: the way back out rides the panel itself,
          and a button under an open sheet is a target nobody can reach. */}
      {!open && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={PANEL_ID}
          // bottom-16, the drawer's own seat: the VAI button is fixed over the
          // bottom-right of every route and was eating the upper two thirds of
          // this one's 44px target.
          className={`${TOGGLE} absolute right-2 bottom-16 grid min-w-11 touch-manipulation place-items-center md:hidden`}
        >
          {t('threed.hud')}
        </button>
      )}
    </div>
  );
}
