// The /code view: a file tree and a pane that shows this site's own source,
// verbatim. Reading the code is the point of the exhibit, so since 2026-08-24 the
// pane colours it — highlight.tsx, a regex tokenizer, which buys the editor look
// for a few hundred bytes instead of the hundred kilobytes a real one costs. The
// tree is 37 entries and on a phone it stood between the nav and the first line of
// code, so there it collapses behind the name of the file it opened on.
import { useEffect, useMemo, useState } from 'react';
import { sourceRead } from '../story';
import { PROJECTS, type CodeFile, type CodeProject } from './codebaseManifest';
import { highlight } from './highlight';

const TREE_ID = 'code-tree';

export default function CodeBase() {
  const [project, setProject] = useState<CodeProject>(PROJECTS[0]);
  const [file, setFile] = useState(project.files[0]);
  const [treeOpen, setTreeOpen] = useState(false);

  // Opening the exhibit at all is the whole quest — nobody arrives here by accident.
  useEffect(() => {
    sourceRead();
  }, []);

  // Keyed by the manifest entry, whose identity is as stable as the build: the
  // largest file here is tens of kilobytes and must not be re-scanned because the
  // tree opened. Nothing else in this view can invalidate a painted file.
  const painted = useMemo(() => highlight(file.content, file.path), [file]);

  function pickProject(p: CodeProject) {
    setProject(p);
    setFile(p.files[0]);
  }

  // Closing is the mobile half of the gesture; on md+ the tree is never hidden, so
  // the flag simply has nothing to say there.
  function pickFile(f: CodeFile) {
    setFile(f);
    setTreeOpen(false);
  }

  const dirs = new Map<string, CodeProject['files']>();
  for (const f of project.files) {
    const dir = f.path.slice(0, f.path.lastIndexOf('/'));
    dirs.set(dir, [...(dirs.get(dir) ?? []), f]);
  }

  return (
    <div className="flex flex-col gap-3 p-3 md:flex-row md:items-start">
      <aside className="md:w-72 md:flex-none">
        <div className="mb-2 flex flex-wrap gap-2">
          {PROJECTS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.id === project.id}
              onClick={() => pickProject(p)}
              className={`cursor-target rounded border border-dashed px-2 py-0.5 font-mono text-xs ${
                p.id === project.id
                  ? 'border-accent text-accent'
                  : 'border-neutral-700 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {/* The phone's tree handle. It names the open file rather than the list it
            opens, because that is the one thing the collapsed tree stops showing. */}
        <button
          type="button"
          aria-expanded={treeOpen}
          aria-controls={TREE_ID}
          onClick={() => setTreeOpen((v) => !v)}
          className="cursor-target mb-2 flex w-full items-center justify-between gap-2 rounded border border-dashed border-neutral-700 px-2 py-1 font-mono text-xs text-neutral-400 md:hidden"
        >
          <span className="truncate text-accent">{file.path}</span>
          <svg
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
            className={`size-3 shrink-0 transition-transform ${treeOpen ? 'rotate-180' : ''}`}
          >
            <path d="M2.5 4.5 6 8l3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div id={TREE_ID} className={`${treeOpen ? 'block' : 'hidden'} md:block`}>
          {[...dirs.entries()].map(([dir, files]) => (
            <div key={dir} className="mb-1">
              <p className="font-mono text-xs leading-5 text-neutral-600">{dir}/</p>
              <ul>
                {files.map((f) => (
                  <li key={f.path}>
                    <button
                      type="button"
                      aria-pressed={f.path === file.path}
                      onClick={() => pickFile(f)}
                      className={`cursor-target block w-full py-0.5 pl-4 text-left font-mono text-sm ${
                        f.path === file.path
                          ? 'text-accent'
                          : 'text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {f.path.slice(f.path.lastIndexOf('/') + 1)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </aside>
      <div className="min-w-0 flex-1 rounded-md border border-dashed border-neutral-800">
        {/* Pinned to whichever scrollport is in play — the stage's own column on
            md+, the page on a phone, where the offset clears the fixed CV strip —
            so a nine-hundred-line file never scrolls away from its own name. */}
        <p className="sticky top-12 z-10 border-b border-dashed border-neutral-800 bg-neutral-950 px-2 py-1 font-mono text-xs text-neutral-400 md:top-0">
          {file.path}
        </p>
        <pre className="scroll-thin overflow-x-auto p-2 font-mono text-xs leading-4 text-neutral-300">
          {painted}
        </pre>
      </div>
    </div>
  );
}
