// The KB figure on every loot card is authored, not measured at runtime — the data
// module feeds the Board chunk and must stay free of `node:fs`. That trade buys a
// number that can silently rot the next time a PDF is regenerated, so the file system
// is read here instead: re-export a resume, forget the byte count, and this goes red.
// The paths resolve from `import.meta.url`, not the cwd, so the suite is honest when
// vitest is launched from somewhere other than the repo root.
import { statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOOT } from './loot.data';

describe('loot data matches shipped files', () => {
  for (const row of LOOT)
    it(`${row.href} bytes are current`, () => {
      expect(statSync(new URL(`../../../../public${row.href}`, import.meta.url)).size).toBe(
        row.bytes,
      );
    });
});
