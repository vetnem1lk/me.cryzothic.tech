import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Dev only: the chat service runs as its own process, so /api/chat reaches it
  // same-origin here exactly as it does behind Caddy in production.
  server: { proxy: { '/api': 'http://127.0.0.1:13331' } },
  // The site's own tests only; server/ is a separate npm project with its own suite.
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
