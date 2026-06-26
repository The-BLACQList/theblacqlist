import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Unit tests only. Playwright e2e specs (e2e/**/*.spec.ts) are intentionally
// excluded so the two runners never collide.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
