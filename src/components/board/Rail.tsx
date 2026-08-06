const SNIPPET = `// commands.ts — vai-shell registry (excerpt)
export function runCommand(raw: string): CommandResult | null {
  const key = raw.trim().toLowerCase().replace(/\\s+/g, ' ');
  const cmd = COMMANDS[key];
  return cmd ? cmd() : null;
}`;

const SUMMARY = 'cursor-target font-mono text-xs text-neutral-300 hover:text-accent';
const FILE = 'pl-4 font-mono text-[11px] leading-5 text-neutral-500';

export default function Rail() {
  return (
    <aside
      data-dock
      className="flex min-h-0 flex-col gap-3 p-3 md:border-l md:border-dashed md:border-neutral-800 md:overflow-y-auto"
    >
      <p className="font-mono text-xs tracking-widest text-neutral-600 uppercase">src — live</p>
      <details open>
        <summary className={SUMMARY}>src/</summary>
        <div className="pl-3">
          <details open>
            <summary className={SUMMARY}>components/board/</summary>
            <ul className={FILE}>
              <li>Board.tsx</li>
              <li>Marquee.tsx</li>
              <li>Rail.tsx</li>
              <li>Stage.tsx</li>
              <li>VaiShell.tsx</li>
              <li>commands.ts</li>
              <li>commands.test.ts</li>
              <li>transport.ts</li>
            </ul>
            <details open>
              <summary className={SUMMARY}>views/</summary>
              <ul className={FILE}>
                <li>Briefing.tsx</li>
                <li>Contact.tsx</li>
                <li>Loot.tsx</li>
                <li>Placeholder.tsx</li>
              </ul>
            </details>
          </details>
          <ul className={FILE}>
            <li>App.tsx</li>
            <li>main.tsx</li>
            <li>index.css</li>
            <li>components/TargetCursor.tsx</li>
            <li>components/FastPath.tsx</li>
          </ul>
        </div>
      </details>
      <div className="rounded-md border border-dashed border-neutral-800 p-2">
        <p className="mb-1 font-mono text-[11px] text-accent">snippet · this site's own code</p>
        <pre className="overflow-x-auto font-mono text-[11px] leading-4 text-neutral-400">{SNIPPET}</pre>
      </div>
    </aside>
  );
}
