// Post-build, last step: write a `.br` sidecar next to every compressible file in
// dist/. Quality 11 is far too slow to run per request, so a server that compresses
// on the fly necessarily serves a weaker level than this; doing it once at build
// time buys the strongest brotli for free at every hit. Pairs with the server's
// `precompressed br` - until that is switched on the sidecars are inert files
// nothing ever reads, which is why this can ship ahead of the server change.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants } from 'node:zlib';

// Text formats plus wasm. Images, fonts and PDFs are already compressed
// containers - brotli over them spends build time to add bytes. Wasm is the
// exception among binaries (~2.2x here), and the did-not-shrink guard below
// would catch a build where that stops being true.
const COMPRESSIBLE = /\.(js|css|html|svg|json|txt|wasm)$/;

// Under a kilobyte the win is a few hundred bytes that vanish inside one TCP
// segment, against a file the deploy has to copy and the server has to stat.
const MIN_BYTES = 1024;

const dist = fileURLToPath(new URL('../dist/', import.meta.url));

let written = 0;
let from = 0;
let to = 0;

for (const entry of readdirSync(dist, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !COMPRESSIBLE.test(entry.name)) continue;

  const file = join(entry.parentPath, entry.name);
  const source = readFileSync(file);
  if (source.length <= MIN_BYTES) continue;

  const compressed = brotliCompressSync(source, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      // Lets the encoder size its window to the input instead of the 16 MB default.
      [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
    },
  });

  // A sidecar at least as big as its source is a pessimisation the server would
  // serve in preference to the original, so fail the build instead of shipping it.
  // Incompressible bytes are the plausible cause: check what landed in dist/.
  if (compressed.length >= source.length) {
    throw new Error(
      `precompress: ${relative(dist, file)} did not shrink (${source.length} -> ${compressed.length} B)`,
    );
  }

  writeFileSync(`${file}.br`, compressed);
  written += 1;
  from += source.length;
  to += compressed.length;
}

console.log(`[precompress] ${written} .br sidecars, ${from} -> ${to} B`);
