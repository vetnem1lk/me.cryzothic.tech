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
            <span key={i}>{STATUS}</span>
          ))}
        </div>
      ))}
    </div>
  );
}
