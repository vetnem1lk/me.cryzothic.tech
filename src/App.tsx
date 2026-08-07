// The page shell. Two things load eagerly because a visitor in a hurry may only
// ever see them — the crosshair cursor and the CV strip — and the interactive
// board arrives behind them as a lazy chunk, so text is on screen first.
import { Suspense, lazy } from 'react';
import FastPath from './components/FastPath';
import TargetCursor from './components/TargetCursor';

const Board = lazy(() => import('./components/board/Board'));

function BoardFallback() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="font-mono text-sm text-neutral-500">loading board…</p>
    </div>
  );
}

export default function App() {
  return (
    <>
      <TargetCursor />
      <FastPath />
      <main className="flex min-h-dvh flex-col bg-neutral-950 pt-12 text-neutral-100">
        <Suspense fallback={<BoardFallback />}>
          <Board />
        </Suspense>
      </main>
    </>
  );
}
