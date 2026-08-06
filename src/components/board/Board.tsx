import Marquee from './Marquee';
import Stage from './Stage';

const CORNER = 'absolute h-2.5 w-2.5 border-accent';
const CORNERS = [
  'top-[-1px] left-[-1px] border-t border-l',
  'top-[-1px] right-[-1px] border-t border-r',
  'bottom-[-1px] left-[-1px] border-b border-l',
  'bottom-[-1px] right-[-1px] border-b border-r',
];

export default function Board() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 pb-3 md:h-[calc(100dvh-3rem)] md:min-h-[520px]">
      <div className="relative flex min-h-0 flex-1 flex-col rounded-lg border border-dashed border-accent/40">
        {CORNERS.map((c) => (
          <span key={c} aria-hidden className={`${CORNER} ${c}`} />
        ))}
        <Marquee />
        <div className="min-h-0 flex-1 md:grid md:grid-cols-[340px_minmax(0,1fr)_300px]">
          <aside
            data-dock
            className="border-b border-dashed border-neutral-800 p-3 md:border-r md:border-b-0"
          >
            vai-shell — lands in Task 4
          </aside>
          <Stage />
          <aside data-dock className="p-3 md:border-l md:border-dashed md:border-neutral-800">
            rail — lands in Task 5
          </aside>
        </div>
      </div>
    </div>
  );
}
