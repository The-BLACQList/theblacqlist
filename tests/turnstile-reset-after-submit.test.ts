// =============================================================================
// Turnstile token is single-use: every form resets the widget after a submit
// =============================================================================
// Found on the production proof walk, 2026-09-21: a sign-up whose first submit
// was rejected server-side (weak password) failed on retry with "Verification
// failed. Please try again." The first submit had spent the Turnstile token,
// the form stayed mounted with the spent token in its hidden input, and the
// retry carried it again. Reloading was the only way out.
//
// The fix is a `resetKey` prop on TurnstileWidget: each change (each settled
// useActionState result) resets the widget so the next attempt has a fresh
// token. These source-contract tests pin down that the widget implements the
// reset and that all five Turnstile forms pass their action state to it.
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

const root = process.cwd()
const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8')

const FORMS = [
  'app/(auth)/sign-up/page.tsx',
  'app/(auth)/sign-in/page.tsx',
  'app/(auth)/forgot-password/page.tsx',
  'components/claim/ClaimForm.tsx',
  'components/entity-page/ReviewForm.tsx',
]

describe('TurnstileWidget resets after a settled submit', () => {
  const widget = read('components/security/TurnstileWidget.tsx')

  it('accepts a resetKey prop', () => {
    expect(widget).toMatch(/resetKey\?: unknown/)
    expect(widget).toMatch(/\{ onToken, theme = 'light', className, resetKey \}/)
  })

  it('calls window.turnstile.reset with the rendered widget id when resetKey changes', () => {
    expect(widget).toMatch(/window\.turnstile\.reset\(id\)/)
    expect(widget).toMatch(/\}, \[resetKey\]\)/)
  })

  it('does not reset on mount (previous key held in a ref, compared with Object.is)', () => {
    expect(widget).toMatch(/const prevResetKeyRef = useRef\(resetKey\)/)
    expect(widget).toMatch(/Object\.is\(prevResetKeyRef\.current, resetKey\)/)
  })
})

describe('every Turnstile form passes its action state as resetKey', () => {
  for (const rel of FORMS) {
    it(rel, () => {
      const src = read(rel)
      expect(src).toMatch(/useActionState\(/)
      const widgets = src.match(/<TurnstileWidget[^>]*\/>/g) ?? []
      expect(widgets.length).toBe(1)
      expect(widgets[0]).toMatch(/resetKey=\{state\}/)
    })
  }
})
