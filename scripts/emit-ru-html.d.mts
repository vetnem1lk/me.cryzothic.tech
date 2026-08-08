// Types for the plain-JS build script, so src/emit-ru-html.test.ts can import it
// without pulling scripts/ into the app's tsconfig program.
export function toRuHtml(
  html: string,
  m?: { title: string; description: string; ogDescription: string },
): string;
