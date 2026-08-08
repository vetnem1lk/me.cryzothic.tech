// What the /code view shows: real source, imported `?raw` so the bundle carries the
// actual files and the exhibit can never drift from the code it claims to be. Two
// projects — this site's front end, and the guardrails of the API behind the chat.
import gatesSrc from '../../../../server/src/gates.ts?raw';
import chatSrc from '../../../../server/src/chat.ts?raw';
import openrouterSrc from '../../../../server/src/openrouter.ts?raw';
import appSrc from '../../../App.tsx?raw';
import cssSrc from '../../../index.css?raw';
import cursorSrc from '../../TargetCursor.tsx?raw';
import boardSrc from '../Board.tsx?raw';
import commandRowSrc from '../CommandRow.tsx?raw';
import stageSrc from '../Stage.tsx?raw';
import textTypeSrc from '../TextType.tsx?raw';
import vaiSrc from '../VaiShell.tsx?raw';
import apiTransportSrc from '../apiTransport.ts?raw';
import commandsSrc from '../commands.ts?raw';
import drainSrc from '../drain.ts?raw';
import transportSrc from '../transport.ts?raw';
import wheelMathSrc from '../wheelMath.ts?raw';
import careerSrc from './Career.tsx?raw';
import ndaSrc from './Nda.tsx?raw';
import skillsSrc from './Skills.tsx?raw';
import i18nContextSrc from '../../../i18n/I18nContext.ts?raw';
import localeSrc from '../../../i18n/locale.ts?raw';
import stripSrc from '../../../i18n/strip.ts?raw';
import emitRuHtmlSrc from '../../../../scripts/emit-ru-html.mjs?raw';

export interface CodeFile {
  path: string;
  content: string;
}

export interface CodeProject {
  id: string;
  label: string;
  files: CodeFile[];
}

// ponytail: two curated projects, not a directory walk — more land when the founder
// picks them (spec §T3c.5). The server entries are the three guardrail modules; the
// private prompts they load are, deliberately, not among them.
export const PROJECTS: CodeProject[] = [
  {
    id: 'site',
    label: 'me.cryzothic.tech',
    files: [
      { path: 'src/App.tsx', content: appSrc },
      { path: 'src/index.css', content: cssSrc },
      { path: 'src/components/TargetCursor.tsx', content: cursorSrc },
      { path: 'src/components/board/Board.tsx', content: boardSrc },
      { path: 'src/components/board/CommandRow.tsx', content: commandRowSrc },
      { path: 'src/components/board/Stage.tsx', content: stageSrc },
      { path: 'src/components/board/TextType.tsx', content: textTypeSrc },
      { path: 'src/components/board/VaiShell.tsx', content: vaiSrc },
      { path: 'src/components/board/apiTransport.ts', content: apiTransportSrc },
      { path: 'src/components/board/commands.ts', content: commandsSrc },
      { path: 'src/components/board/drain.ts', content: drainSrc },
      { path: 'src/components/board/transport.ts', content: transportSrc },
      { path: 'src/components/board/wheelMath.ts', content: wheelMathSrc },
      { path: 'src/components/board/views/Career.tsx', content: careerSrc },
      { path: 'src/components/board/views/Nda.tsx', content: ndaSrc },
      { path: 'src/components/board/views/Skills.tsx', content: skillsSrc },
      { path: 'src/i18n/I18nContext.ts', content: i18nContextSrc },
      { path: 'src/i18n/locale.ts', content: localeSrc },
      { path: 'src/i18n/strip.ts', content: stripSrc },
      // files[0] is the exhibit's landing file, so src/ leads and scripts/ trails ASCII.
      { path: 'scripts/emit-ru-html.mjs', content: emitRuHtmlSrc },
    ],
  },
  {
    id: 'vai-api',
    label: 'vai-api (guardrails)',
    files: [
      { path: 'server/src/chat.ts', content: chatSrc },
      { path: 'server/src/gates.ts', content: gatesSrc },
      { path: 'server/src/openrouter.ts', content: openrouterSrc },
    ],
  },
];
