// The header row and the closing line every sector view wears: the route it sits on,
// its own count as a two-digit numeral, and the commit the bundle was built from.
import type { ReactNode } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');
export function Masthead({ path, count, children }: { path: string; count: number; children: ReactNode }) {
  return (
    <div className="flex items-end justify-between border-b border-dashed border-neutral-800 pb-2">
      <div>{children}<p className="font-mono text-xs text-neutral-400">{path}</p></div>
      <span aria-hidden className="font-mono text-5xl leading-none text-neutral-400 sm:text-6xl">{pad(count)}</span>
    </div>
  );
}
export function Rail({ path, count }: { path: string; count: number }) {
  return (
    <p aria-hidden className="mt-auto border-t border-dashed border-neutral-800 pt-2 font-mono text-xs text-neutral-400">
      {path} · {pad(count)} · REV {__BUILD_REV__}
    </p>
  );
}
