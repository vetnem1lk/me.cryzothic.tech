// Deploy smoke: fetch everything a visitor or a crawler can reach without running our
// JS, and check the things a broken deploy breaks - the status, the media type, whether
// any bytes came back at all, and for the rows where 200 text/html is not enough, one
// substring that says which document answered. Deliberately not byte-exact: every file
// in the table is expected to change, so a pinned length would fail on every content
// edit and teach the operator to ignore it.
//
//   node scripts/smoke.mjs https://me.cryzothic.tech
//   node scripts/smoke.mjs http://localhost:4173 --local
//
// --local drops the rows marked `rewrite`. Deep links under /ru/ are documents only
// because the front end rewrites them to the RU index; `vite preview` has no such rule
// and answers from the English document or not at all, so a local assert there would
// grade the preview server rather than the site. Everything else holds in both places.

const HTML = 'text/html';

// [path, acceptable content-type prefixes, body needle, scope]
// The needle is what tells the two documents apart: they are both 200 text/html, so an
// EN fallback served under a RU path passes every header check. `<html lang>` is the
// first thing in either document and the one attribute that differs by build, not by
// content edit. Anchored to the opening tag: both documents carry an `hreflang="ru"`
// alternate link, so a bare `lang="ru"` is a substring of the English document too.
const TARGETS = [
  ['/', [HTML]],
  ['/ru/', [HTML], '<html lang="ru"'],
  ['/ru/career', [HTML], '<html lang="ru"', 'rewrite'],
  // Not a route - the trap that proves the /ru match is segment-aware. The needle is the
  // proof: it has to come back as the English document, never the Russian one.
  ['/rules', [HTML], '<html lang="en"'],
  // One row per photo tier, so a half-copied dist/photos shows up as a media type or a
  // 404 rather than as a blank slot someone notices weeks later.
  ['/photos/ch-01-640.avif', ['image/avif']],
  ['/photos/ch-01-1280.avif', ['image/avif']],
  ['/photos/ch-01-1280.jpg', ['image/jpeg']],
  ['/cv/Klimentev_Vladislav_CPP_Developer_EN.pdf', ['application/pdf']],
  ['/robots.txt', ['text/plain']],
  ['/sitemap.xml', ['application/xml', 'text/xml']],
  // The 3D viewer's assets live outside the deploy root (versioned /g2/v1/ path,
  // immutable cache) - HEAD only: a body row would pull megabytes through CI to
  // learn nothing the headers don't already say. Byte sizes are pinned elsewhere.
  ['/g2/v1/scene_mb2_final.glb', ['model/gltf-binary'], undefined, 'head'],
  ['/g2/v1/scene_fb2_final.glb', ['model/gltf-binary'], undefined, 'head'],
  // All seven tint masks: the HUD fetches them on the first tint interaction, so a
  // missing one is a live feature break, not a spare asset. Hair is the seventh and
  // the one a count of the module list misses - it has its own picker in the head
  // cluster and is not a MODULE_ID.
  ['/g2/v1/masks/Shirts_M@1024.ktx2', ['image/ktx2'], undefined, 'head'],
  ['/g2/v1/masks/MShirts_M@1024.ktx2', ['image/ktx2'], undefined, 'head'],
  ['/g2/v1/masks/Pants_M@1024.ktx2', ['image/ktx2'], undefined, 'head'],
  ['/g2/v1/masks/Gloves_M@1024.ktx2', ['image/ktx2'], undefined, 'head'],
  ['/g2/v1/masks/Shoes_M@1024.ktx2', ['image/ktx2'], undefined, 'head'],
  ['/g2/v1/masks/Mask_M@1024.ktx2', ['image/ktx2'], undefined, 'head'],
  ['/g2/v1/masks/Hair_M@1024.ktx2', ['image/ktx2'], undefined, 'head'],
];

const [base, ...flags] = process.argv.slice(2);
if (!base || base.startsWith('-')) {
  console.error('usage: node scripts/smoke.mjs <base-url> [--local]');
  process.exit(1);
}
const origin = base.replace(/\/+$/, '');
const local = flags.includes('--local');

let failures = 0;

for (const [path, types, needle, scope] of TARGETS) {
  if (local && scope === 'rewrite') {
    console.log(`skip ${path} - needs the server-side rewrite (--local)`);
    continue;
  }

  const head = scope === 'head';
  let response;
  let bytes;
  let body;
  try {
    // manual: a redirect is a finding, not something to follow silently - these URLs
    // are the ones crawlers and CV readers hold, and they must answer for themselves.
    // The timeout keeps a hung front end a FAIL row below rather than a hung script.
    response = await fetch(origin + path, {
      method: head ? 'HEAD' : 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    if (!head) {
      // The body, not the content-length header: a compressing front end drops that
      // header and answers chunked, so the bytes that actually arrived are the only
      // count present on every hop.
      const buffer = await response.arrayBuffer();
      bytes = buffer.byteLength;
      // Decoded only where a needle asks for it - the image and PDF rows must stay bytes.
      if (needle) body = new TextDecoder().decode(buffer);
    }
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${path} - ${error.message}`);
    continue;
  }

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  const problems = [];
  if (response.status !== 200) problems.push(`status ${response.status}`);
  if (!types.some((type) => contentType.startsWith(type))) {
    problems.push(`content-type ${contentType || '(none)'}, want ${types.join(' | ')}`);
  }
  if (head) {
    // Immutable is the whole hosting contract for /g2: unhashed filenames are only
    // honest to cache forever because the path itself is versioned.
    const cacheControl = response.headers.get('cache-control') ?? '';
    if (!cacheControl.includes('immutable')) {
      problems.push(`cache-control ${cacheControl || '(none)'}, want immutable`);
    }
  } else {
    if (bytes === 0) problems.push('empty body');
    if (needle && !body.includes(needle)) problems.push(`body missing ${needle}`);
  }

  if (problems.length) {
    failures += 1;
    console.log(`FAIL ${path} - ${problems.join('; ')}`);
  } else {
    console.log(`ok   ${path} - ${contentType.split(';')[0]}${head ? ' (HEAD)' : `, ${bytes} B`}`);
  }
}

console.log(failures ? `\n${failures} failed` : `\nall ok`);
// exitCode, not exit(): forcing the process down while fetch's keep-alive sockets are
// still closing trips a libuv assertion on Windows and replaces the count with 127 -
// the one number this script exists to report.
process.exitCode = failures;
