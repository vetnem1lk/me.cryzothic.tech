// The telemetry corner: FPS + draw calls + triangles off renderer.info, polled
// at 2 Hz. Hand-rolled — three already counts everything, a stats lib would be
// 8 KB of someone else's canvas. Numbers are sibling text nodes, aria-hidden:
// this is instrumentation, not content. It reads as an instrument too — a
// dashed chip in the bottom-left corner, which the credit strip used to own.
import { useEffect, useState } from 'react';

export interface ViewerStats {
  fps: number;
  calls: number;
  tris: number;
}

export default function FpsOverlay({ read }: { read: () => ViewerStats }) {
  const [stats, setStats] = useState<ViewerStats>({ fps: 0, calls: 0, tris: 0 });

  useEffect(() => {
    const id = setInterval(() => setStats(read()), 500);
    return () => clearInterval(id);
  }, [read]);

  return (
    <p
      aria-hidden
      className="pointer-events-none absolute bottom-2 left-2 z-10 rounded border border-dashed border-neutral-800 bg-neutral-950/70 px-1.5 py-0.5 font-mono text-[11px] leading-none text-neutral-500"
    >
      {stats.fps} fps · {stats.calls} calls · {(stats.tris / 1000).toFixed(1)}k tris
    </p>
  );
}
