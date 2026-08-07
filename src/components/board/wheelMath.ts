// How the command row answers a wheel: what one event is worth in pixels, and
// where those pixels put the row next — or null when the event belongs to the
// page instead. Pure math, no DOM, so both rules are testable without a browser.

/**
 * Wheel deltas are not always pixels. Firefox mouse wheels report lines
 * (`deltaMode` 1, roughly ±3 per notch) and some devices report pages
 * (`deltaMode` 2), so an unscaled delta would crawl the row ~3px per notch
 * while the handler still swallowed the page scroll. 16 ≈ one line here.
 */
export function wheelPx(
  e: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode'>,
  pageSize: number,
): number {
  const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? pageSize : 1;
  return (e.deltaX + e.deltaY) * scale;
}

/**
 * The next `scrollLeft`, or `null` to leave the event to the page.
 * `period > 0` is the looping duplicated track (motion mode): always
 * consumable, negative overflow wraps by one period — forward overflow is the
 * row's own `wrap()` job. `period` 0 is the static reduced-motion track:
 * consume only if the clamp actually moves.
 */
export function wheelStep(
  scrollLeft: number,
  delta: number,
  period: number,
  maxScroll: number,
): number | null {
  if (!delta) return null;
  let next = scrollLeft + delta;
  if (period > 0) {
    while (next < 0) next += period;
    return next;
  }
  next = Math.max(0, Math.min(next, maxScroll));
  return next === scrollLeft ? null : next;
}
