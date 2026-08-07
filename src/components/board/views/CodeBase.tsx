// The /code view: a file tree and a pane that shows this site's own source,
// verbatim. Reading the code is the point of the exhibit, so this is deliberately
// a plain <pre> — no syntax highlighter, no extra kilobytes for decoration.
import { useState } from 'react';
import { PROJECTS, type CodeProject } from './codebaseManifest';

export default function CodeBase() {
  const [project, setProject] = useState<CodeProject>(PROJECTS[0]);
  const [file, setFile] = useState(project.files[0]);

  function pickProject(p: CodeProject) {
    setProject(p);
    setFile(p.files[0]);
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
              className={`cursor-target rounded border border-dashed px-2 py-0.5 font-mono text-[11px] ${
                p.id === project.id
                  ? 'border-accent text-accent'
                  : 'border-neutral-700 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {[...dirs.entries()].map(([dir, files]) => (
          <div key={dir} className="mb-1">
            <p className="font-mono text-[11px] leading-5 text-neutral-600">{dir}/</p>
            <ul>
              {files.map((f) => (
                <li key={f.path}>
                  <button
                    type="button"
                    aria-pressed={f.path === file.path}
                    onClick={() => setFile(f)}
                    className={`cursor-target block w-full py-0.5 pl-4 text-left font-mono text-xs ${
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
      </aside>
      <div className="min-w-0 flex-1 rounded-md border border-dashed border-neutral-800">
        <p className="border-b border-dashed border-neutral-800 px-2 py-1 font-mono text-[11px] text-neutral-500">
          {file.path}
        </p>
        <pre className="scroll-thin overflow-x-auto p-2 font-mono text-[11px] leading-4 text-neutral-300">
          {file.content}
        </pre>
      </div>
    </div>
  );
}
