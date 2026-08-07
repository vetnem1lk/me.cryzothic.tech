import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The site's own tests only; server/ is a separate npm project with its own suite.
  test: { include: ['src/**/*.test.{ts,tsx}'] },
})
