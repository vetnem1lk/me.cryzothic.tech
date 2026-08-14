import { execSync } from 'node:child_process'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Dev only: the chat service runs as its own process, so /api/chat reaches it
  // same-origin here exactly as it does behind the reverse proxy in production.
  // /g2 = the 3D viewer's versioned assets, hosted on the box outside this repo;
  // dev and preview borrow the production copies so the viewer works locally.
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:13331',
      '/g2': { target: 'https://me.cryzothic.tech', changeOrigin: true },
    },
  },
  // 2000, just under the smallest Cyrillic woff2 (2 028 B): the default 4096 base64s
  // both cyrillic-ext subsets into the render-blocking CSS, where every EN visitor
  // pays for glyphs only the RU page uses. They are the only assets in that window,
  // so this splits exactly those two out as on-demand files.
  build: { assetsInlineLimit: 2000 },
  // The commit the bundle was built from, printed by the sector rails. Resolved at
  // config load, so it also runs under vitest — where git may be absent, hence 'dev'.
  define: {
    __BUILD_REV__: JSON.stringify((() => {
      try { return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return 'dev' }
    })()),
  },
  // The site's own tests only; server/ is a separate npm project with its own suite.
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
