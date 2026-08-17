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
    alias: {
      '@': path.resolve(__dirname, '.'),
      // `server-only` is not a package in this tree — Next resolves it to its own
      // compiled stub at build time, so nothing installs it. Vitest has no such
      // alias, so any module carrying the server-only guard was unimportable in a
      // test. Point at the same stub Next uses rather than dropping the guard,
      // which is the only thing keeping those modules out of a client bundle.
      'server-only': path.resolve(__dirname, 'node_modules/next/dist/compiled/server-only/empty.js'),
    },
  },
})
