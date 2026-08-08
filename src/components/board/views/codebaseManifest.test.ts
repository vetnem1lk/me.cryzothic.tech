// Pins the /code exhibit's landing file. CodeBase.tsx seeds its pane from `files[0]`,
// so the manifest's array order is user-visible: sorting the list by plain path ASCII
// puts `scripts/` first and silently opens the flagship exhibit on a build script
// instead of the shell. One assertion turns that into a red test rather than a
// screenshot nobody takes.
import { expect, test } from 'vitest';
import { PROJECTS } from './codebaseManifest';

test('the /code exhibit opens on the site shell', () => {
  expect(PROJECTS[0].files[0].path).toBe('src/App.tsx');
});
