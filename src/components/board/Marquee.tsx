// The status bar across the top of the board — the line that tells a visitor
// what this site is before any of the game furniture makes sense. The string is
// repeated for width only, and every copy past the first is aria-hidden.
const STATUS = 'UNLOCKED: C++ / Qt Developer Portfolio · Target: GameDev';

export default function Marquee() {
  return (
    <div
      data-dock
      className="flex gap-12 overflow-hidden border-b border-dashed border-neutral-800 px-3 py-1.5"
    >
      {[0, 1].map((dup) => (
        <div
          key={dup}
          aria-hidden={dup === 1 || undefined}
          className="marquee-track flex min-w-full shrink-0 justify-around gap-12 font-mono text-[11px] tracking-[0.2em] whitespace-nowrap text-neutral-500 uppercase"
        >
          {[0, 1, 2].map((i) => (
            <span key={i} aria-hidden={i > 0 || undefined}>{STATUS}</span>
          ))}
        </div>
      ))}
    </div>
  );
}
