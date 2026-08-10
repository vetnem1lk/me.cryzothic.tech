// Deploy smoke: fetch everything a visitor or a crawler can reach without running our
// JS, and check the three things a broken deploy breaks - the status, the media type,
// and whether any bytes came back at all. Deliberately not byte-exact: every file in
// the table is expected to change, so a pinned length would fail on every content edit
// and teach the operator to ignore it.
//
//   node scripts/smoke.mjs https://me.cryzothic.tech
//   node scripts/smoke.mjs http://localhost:4173 --local
//
// --local drops the rows marked `rewrite`. Deep links under /ru/ are documents only
// because the front end rewrites them to the RU index; `vite preview` has no such rule
// and answers from the English document or not at all, so a local assert there would
// grade the preview server rather than the site. Everything else holds in both places.

const HTML = 'text/html';

// [path, acceptable content-type prefixes, scope]
const TARGETS = [
  ['/', [HTML]],
  ['/ru/', [HTML]],
  ['/ru/career', [HTML], 'rewrite'],
  // Not a route - the trap that proves the /ru match is segment-aware. It has to come
  // back as the English document, never the Russian one.
  ['/rules', [HTML]],
  // One row per photo tier, so a half-copied dist/photos shows up as a media type or a
  // 404 rather than as a blank slot someone notices weeks later.
  ['/photos/ch-01-640.avif', ['image/avif']],
  ['/photos/ch-01-1280.avif', ['image/avif']],
  ['/photos/ch-01-1280.jpg', ['image/jpeg']],
  ['/cv/Klimentev_Vladislav_CPP_Developer_EN.pdf', ['application/pdf']],
  ['/robots.txt', ['text/plain']],
  ['/sitemap.xml', ['application/xml', 'text/xml']],
];

const [base, ...flags] = process.argv.slice(2);
if (!base || base.startsWith('-')) {
  console.error('usage: node scripts/smoke.mjs <base-url> [--local]');
  process.exit(1);
}
const origin = base.replace(/\/+$/, '');
const local = flags.includes('--local');

let failures = 0;

for (const [path, types, scope] of TARGETS) {
  if (local && scope === 'rewrite') {
    console.log(`skip ${path} - needs the server-side rewrite (--local)`);
    continue;
  }

  let response;
  let bytes;
  try {
    // manual: a redirect is a finding, not something to follow silently - these URLs
    // are the ones crawlers and CV readers hold, and they must answer for themselves.
    response = await fetch(origin + path, { redirect: 'manual' });
    // The body, not the content-length header: a compressing front end drops that
    // header and answers chunked, so the bytes that actually arrived are the only
    // count present on every hop.
    bytes = (await response.arrayBuffer()).byteLength;
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
  if (bytes === 0) problems.push('empty body');

  if (problems.length) {
    failures += 1;
    console.log(`FAIL ${path} - ${problems.join('; ')}`);
  } else {
    console.log(`ok   ${path} - ${contentType.split(';')[0]}, ${bytes} B`);
  }
}

console.log(failures ? `\n${failures} failed` : `\nall ok`);
// exitCode, not exit(): forcing the process down while fetch's keep-alive sockets are
// still closing trips a libuv assertion on Windows and replaces the count with 127 -
// the one number this script exists to report.
process.exitCode = failures;
