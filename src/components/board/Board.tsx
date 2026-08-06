import { useState } from 'react';
import Marquee from './Marquee';
import Rail from './Rail';
import Stage from './Stage';
import VaiShell from './VaiShell';

const CORNER = 'absolute h-2.5 w-2.5 border-accent';
const CORNERS = [
  'top-[-1px] left-[-1px] border-t border-l',
  'top-[-1px] right-[-1px] border-t border-r',
  'bottom-[-1px] left-[-1px] border-b border-l',
  'bottom-[-1px] right-[-1px] border-b border-r',
];

export default function Board() {
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 pb-3 md:h-[calc(100dvh-3rem)] md:min-h-[520px]">
      <div className="relative flex min-h-0 flex-1 flex-col rounded-lg border border-dashed border-accent/40">
        {CORNERS.map((c) => (
          <span key={c} aria-hidden className={`${CORNER} ${c}`} />
        ))}
        <Marquee />
        <div className="min-h-0 flex-1 md:grid md:grid-cols-[340px_minmax(0,1fr)_300px]">
          <VaiShell mobileOpen={sheetOpen} onMobileClose={() => setSheetOpen(false)} />
          <Stage />
          <Rail />
        </div>
      </div>
      {!sheetOpen && (
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="cursor-target fixed right-3 bottom-3 z-40 rounded-md border border-dashed border-accent/60 bg-neutral-950/90 px-3 py-2 font-mono text-xs text-accent md:hidden"
        >
          V-Agent
        </button>
      )}
    </div>
  );
}
