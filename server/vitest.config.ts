// Keeps this subproject's test run self-contained: without a config here vitest
// walks up and adopts the site's vite.config.ts (React + Tailwind plugins and all).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
