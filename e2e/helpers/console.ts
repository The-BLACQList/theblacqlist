import type { Page } from '@playwright/test'

// Benign console noise to ignore when asserting "no console errors". Keep this
// list tight — only add entries that are confirmed not real defects.
const BENIGN = [
  /favicon\.ico/i,
  /Download the React DevTools/i,
  /\[Vercel (Web Analytics|Speed Insights)\]/i, // dev debug logs
  /Failed to load resource.*404.*(favicon|apple-touch-icon)/i,
]

function isBenign(text: string): boolean {
  return BENIGN.some((re) => re.test(text))
}

/**
 * Subscribes to console errors and uncaught page errors for the lifetime of the
 * page. Returns a getter for the collected (non-benign) error messages so a
 * cross-browser test can assert there were none.
 */
export function trackConsoleErrors(page: Page): () => string[] {
  const errors: string[] = []

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (!isBenign(text)) errors.push(`[console.error] ${text}`)
  })

  page.on('pageerror', (err) => {
    const text = err.message ?? String(err)
    if (!isBenign(text)) errors.push(`[pageerror] ${text}`)
  })

  return () => errors
}
