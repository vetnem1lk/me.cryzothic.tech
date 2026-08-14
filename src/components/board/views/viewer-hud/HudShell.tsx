// The overlay chrome every control cluster mounts inside: a floating column on
// the frame's right edge, folded into a bottom sheet behind a toggle on phones.
// One panel node, two layouts — the clusters render once, so nothing has to be
// kept in sync between a desktop copy and a mobile one.
//
// The wrapper stays pointer-transparent on purpose: the canvas underneath is
// the orbit surface, and only the panel and its button may swallow a drag.
import type { ReactNode } from 'react';
import { useT } from '../../../../i18n/I18nContext';

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
      {/* pb-16 is the toggle button's seat: it floats over this sheet's
          bottom-right corner, and without the reserve the last control in the
          scroller ends up underneath it. */}
      <div
        className={`pointer-events-auto absolute inset-x-0 bottom-0 max-h-[45%] space-y-1.5 overflow-y-auto border border-dashed border-accent/40 bg-neutral-950/85 p-2 pb-16 font-mono text-xs text-neutral-300 md:inset-x-auto md:top-2 md:right-2 md:bottom-auto md:block md:max-h-[calc(100%-1rem)] md:w-60 md:pb-2 ${
          open ? '' : 'hidden'
        }`}
      >
        {children}
      </div>
      {/* Painted after the panel, so it stays reachable while the sheet is open. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="cursor-target pointer-events-auto absolute right-2 bottom-2 rounded-md border border-dashed border-accent/60 bg-neutral-950/90 px-3 py-2 font-mono text-xs text-accent hover:border-accent md:hidden"
      >
        {t('threed.hud')}
      </button>
    </div>
  );
}
