// The terminal's submit queue. VaiShell holds one promise ref and hangs every turn
// off it, so a second question waits for the first answer to finish typing rather
// than racing it onto the screen — the ordering the shell claims beside that ref
// is this file, and queue.test.ts is what holds it to the claim.

/**
 * Runs `task` once `prev` has settled, whichever way it settled: a turn that
 * failed must not strand the questions behind it, so the queue survives its own
 * links breaking. What it does not do is swallow the task's own failure — the
 * returned promise rejects with it, because the call site is where the
 * `[sys] transport error` line is written, and a chain that ate the error would
 * leave the visitor with silence instead.
 */
export const chain = (prev: Promise<void>, task: () => Promise<void>): Promise<void> =>
  prev.catch(() => {}).then(task);
