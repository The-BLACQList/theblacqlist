// =============================================================================
// M4.14 — one save metaphor, one visible saved state
// =============================================================================
// The founder's words: "the save listing on the discover page is hard to
// differentiate from liking or hearting the listing on the page itself. Are
// these the same action?"
//
// They are the same action — POST/DELETE /api/saves — drawn with three
// different icons. This file pins the fixes that answer him, and one of them is
// a real bug that no type check or lint rule can see:
//
//   `cn()` (tailwind-merge) resolves conflicts LAST-WINS. `SaveButton` put its
//   saved-state `bg-amber-gold/20` before the caller's `className`, and both
//   heroes passed `bg-white/20 … backdrop-blur-sm`. The caller won on every
//   render, so THE SAVED BACKGROUND HAS NEVER APPEARED on a listing page. The
//   fix moved the surface into a `surface` prop the caller cannot override, and
//   the regression guard below is "no call site passes a `bg-` class" — because
//   the moment one does, the bug is back, silently, exactly as before.
//
// vitest runs in a node environment with no jsdom (vitest.config.ts), so source
// text is the evidence available. That is the right instrument here anyway: the
// question is "can a caller still override the saved colour", which is a
// property of the call sites, not of a rendered tree.
//
// ⚠ These files DISCUSS `bg-white/20`, `bg-amber-gold` and `Heart` in their
// comments — the comments explain the bug. Every "does not contain" assertion
// below is therefore scoped to a specific element or import, never to whole-file
// text, or it would fail on the explanation of the thing it is checking.
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

function source(relPath: string): string {
  return readFileSync(path.resolve(process.cwd(), relPath), 'utf8')
}

const SAVE_ICON_BUTTON = 'components/ui/save-icon-button.tsx'
const SAVE_BUTTON = 'components/entity-page/SaveButton.tsx'

/** The two controls that draw a save state. */
const SAVE_CONTROLS = [SAVE_ICON_BUTTON, SAVE_BUTTON] as const

/** The named imports a file takes from lucide-react. */
function lucideImports(src: string): string[] {
  const match = src.match(/import\s*\{([^}]*)\}\s*from\s*'lucide-react'/)
  if (!match) return []
  return match[1]!
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Every self-closing `<Component … />` element in a file, as raw text. */
function elements(src: string, component: string): string[] {
  return src.match(new RegExp(`<${component}\\b[\\s\\S]*?/>`, 'g')) ?? []
}

// ─────────────────────────────────────────────────────────────────────────────

describe('one icon family', () => {
  it.each(SAVE_CONTROLS)('%s draws a Bookmark', (file) => {
    expect(lucideImports(source(file))).toContain('Bookmark')
  })

  it.each(SAVE_CONTROLS)('%s does not draw a Heart', (file) => {
    // A heart reads as a public "like". Saving is private — /account/saved is a
    // list, not a signal to the business. Two metaphors for one endpoint is the
    // whole complaint, so the check is on the IMPORT, not on file text: both
    // files mention the word "heart" in the comment explaining this.
    const imported = lucideImports(source(file))
    expect(imported.filter((name) => name.startsWith('Heart'))).toEqual([])
  })

  it.each(SAVE_CONTROLS)('%s signals saved by filling the glyph', (file) => {
    // A FILLED bookmark beats a DIFFERENT glyph (BookmarkCheck): at 18px across
    // a 24-card grid, a swapped glyph is not a signal anyone sees.
    expect(source(file)).toMatch(/fill=\{[\w]+ \? 'currentColor' : 'none'\}/)
    expect(lucideImports(source(file))).not.toContain('BookmarkCheck')
  })

  it.each(SAVE_CONTROLS)('%s exposes the toggle state to assistive tech', (file) => {
    expect(source(file)).toContain('aria-pressed=')
  })
})

describe('live regions announce changes, not initial state', () => {
  it.each(SAVE_CONTROLS)('%s seeds its live region empty', (file) => {
    // The old code seeded `message` from the current state, so every card on a
    // 24-card grid MOUNTED containing "<name> removed from saved" for a listing
    // that was never saved — 24 blocks of false text in the a11y tree. A live
    // region reports CHANGES; before the first one it has nothing to say.
    const src = source(file)
    expect(src).toMatch(/const \[message, setMessage\] = useState\(''\)/)
    expect(src).toContain('aria-live="polite"')
    expect(src).toContain('{message}')
  })

  it.each(SAVE_CONTROLS)('%s announces a failed save instead of reverting silently', (file) => {
    // Before: a 500 flipped the icon back with no explanation, which reads as
    // the button being broken rather than the save having failed.
    const src = source(file)
    expect(src).toMatch(/function rollback\(/)
    expect(src).toContain("Couldn't save. Try again.")
    expect(src).toContain('ring-red-500')
  })
})

describe('the confirmation pop cannot fire on page load', () => {
  const src = source(SAVE_ICON_BUTTON)

  it('starts unpopped', () => {
    expect(src).toMatch(/const \[popping, setPopping\] = useState\(false\)/)
  })

  it('is raised only by a click, never derived from initialIsSaved', () => {
    // Deriving it from state would pop every already-saved card on load — 24
    // cards jumping at once, on a page the user did not interact with.
    const clickIdx = src.indexOf('function handleClick')
    expect(clickIdx).toBeGreaterThan(-1)

    const raises = [...src.matchAll(/setPopping\(true\)/g)].map((m) => m.index!)
    expect(raises).toHaveLength(1)
    expect(raises[0]!).toBeGreaterThan(clickIdx)
  })

  it('clears on a timeout as well as on animationend', () => {
    // ⚠ Load-bearing. Under prefers-reduced-motion the animation does not
    // exist, so `animationend` NEVER fires — without the timeout the class
    // would stick forever on the first save.
    expect(src).toContain('onAnimationEnd={() => setPopping(false)}')
    expect(src).toMatch(/setTimeout\(\(\) => setPopping\(false\), POP_MS\)/)
  })
})

describe('no call site can override the saved surface', () => {
  // THE regression guard for the tailwind-merge bug described at the top.
  // `className` is for sizing and position; `surface` owns the colours.
  const CALL_SITES = [
    'components/entity-page/EntityPageHero.tsx',
    'components/entity-page/templates/TemplateHero.tsx',
    'components/entity-page/EntityQuickActionBar.tsx',
    'app/account/saved/page.tsx',
  ] as const

  it.each(CALL_SITES)('%s passes no background to SaveButton', (file) => {
    const found = elements(source(file), 'SaveButton')
    expect(found.length, `${file} should render at least one SaveButton`).toBeGreaterThan(0)

    for (const el of found) {
      expect(el, `background class passed to SaveButton in ${file}`).not.toMatch(/\bbg-/)
      expect(el, `backdrop filter passed to SaveButton in ${file}`).not.toMatch(/backdrop-blur/)
    }
  })

  it('passes no background to SaveIconButton from the discover card', () => {
    const found = elements(source('components/entities/EntityCard.tsx'), 'SaveIconButton')
    expect(found.length).toBeGreaterThan(0)
    for (const el of found) {
      expect(el).not.toMatch(/\bbg-/)
    }
  })

  it.each([
    'components/entity-page/EntityPageHero.tsx',
    'components/entity-page/templates/TemplateHero.tsx',
  ])('%s uses the labelled variant on the photo scrim', (file) => {
    // "Save" / "Saved" in words is the single clearest answer to "are these the
    // same action?" — an icon alone is what made the card and the page read as
    // two different things. Icons stay where space is genuinely tight.
    const el = elements(source(file), 'SaveButton')[0]!
    expect(el).toContain('variant="pill"')
    expect(el).toContain('surface="hero"')
  })

  it('declares one surface table that covers saved and unsaved together', () => {
    // Both states live in one lookup so they cannot drift apart, and so a
    // caller has nothing left to override.
    const src = source(SAVE_BUTTON)
    expect(src).toMatch(/const SURFACE: Record<Surface, \{ saved: string; unsaved: string \}>/)
    for (const surface of ['hero', 'bar', 'light']) {
      expect(src, `${surface} surface`).toMatch(new RegExp(`\\b${surface}:\\s*\\{`))
    }
  })

  it('renders the saved state as solid gold, not a tint', () => {
    // `/20` over an arbitrary cover photo is invisible even when it does
    // render. #000 on #c4a065 measures 8.56:1 — AA and AAA for text and UI.
    expect(source(SAVE_BUTTON)).toContain('bg-amber-gold text-brand-black')
    expect(source(SAVE_ICON_BUTTON)).toContain('bg-amber-gold text-brand-black')
  })
})

describe('the pop animation follows the house reduced-motion pattern', () => {
  const css = source('app/globals.css')

  it('defines the class and its keyframes', () => {
    expect(css).toContain('.blacq-save-pop {')
    expect(css).toContain('@keyframes blacq-save-pop')
  })

  it('declares the class exactly once', () => {
    // Two rules would mean a base rule plus an override — the legacy
    // kill-switch shape this deliberately avoids.
    expect(css.split('.blacq-save-pop {').length - 1).toBe(1)
  })

  it('puts the animation inside a no-preference query, not in a base rule', () => {
    // The house pattern (`.blacq-reveal`, `.blacq-tour-spotlight`): motion
    // EXISTS ONLY inside `prefers-reduced-motion: no-preference`. The legacy
    // form — animate in the base rule, then `animation: none` under `reduce` —
    // is `.blacq-map-highlight`, and it is the one not to copy: it leaves the
    // animation as the default and the accessible variant as the exception.
    const idx = css.indexOf('.blacq-save-pop {')
    expect(idx).toBeGreaterThan(-1)

    const header = enclosingBlockHeader(css, idx)
    expect(header).toContain('@media (prefers-reduced-motion: no-preference)')
  })

  it('carries no reduce kill-switch', () => {
    expect(css).not.toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.blacq-save-pop/
    )
  })
})

/**
 * The header of the innermost `{ … }` block enclosing `index`, or null when the
 * position is at the top level of the stylesheet.
 */
function enclosingBlockHeader(src: string, index: number): string | null {
  let depth = 0
  for (let i = index - 1; i >= 0; i--) {
    const ch = src[i]
    if (ch === '}') depth++
    else if (ch === '{') {
      if (depth === 0) {
        const prevOpen = src.lastIndexOf('{', i - 1)
        const prevClose = src.lastIndexOf('}', i - 1)
        return src.slice(Math.max(prevOpen, prevClose) + 1, i).trim()
      }
      depth--
    }
  }
  return null
}
