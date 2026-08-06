import appSrc from '../../../App.tsx?raw';
import cssSrc from '../../../index.css?raw';
import cursorSrc from '../../TargetCursor.tsx?raw';
import boardSrc from '../Board.tsx?raw';
import stageSrc from '../Stage.tsx?raw';
import textTypeSrc from '../TextType.tsx?raw';
import vaiSrc from '../VaiShell.tsx?raw';
import commandsSrc from '../commands.ts?raw';
import transportSrc from '../transport.ts?raw';

export interface CodeFile {
  path: string;
  content: string;
}

export interface CodeProject {
  id: string;
  label: string;
  files: CodeFile[];
}

// ponytail: one seed project (this site, curated files) — the UI is already
// multi-project; more projects land when the founder picks them (spec §T3c.5).
export const PROJECTS: CodeProject[] = [
  {
    id: 'site',
    label: 'me.cryzothic.tech',
    files: [
      { path: 'src/App.tsx', content: appSrc },
      { path: 'src/index.css', content: cssSrc },
      { path: 'src/components/TargetCursor.tsx', content: cursorSrc },
      { path: 'src/components/board/Board.tsx', content: boardSrc },
      { path: 'src/components/board/Stage.tsx', content: stageSrc },
      { path: 'src/components/board/TextType.tsx', content: textTypeSrc },
      { path: 'src/components/board/VaiShell.tsx', content: vaiSrc },
      { path: 'src/components/board/commands.ts', content: commandsSrc },
      { path: 'src/components/board/transport.ts', content: transportSrc },
    ],
  },
];
