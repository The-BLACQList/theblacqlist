// =============================================================================
// /flow-map page: the Silo (ticket 167)
// =============================================================================
// Ticket 167 replaced the city/category filters, the SVG network and the
// summary cards with the Silo. This suite pins what the page must keep doing
// through that change, and the a11y and loading rules the Silo adds:
//
//   1. Every named per-business or per-city read stays gated at
//      AGGREGATE_MIN_TRANSACTIONS, and the community total still leaves out
//      receipts kept out of community figures.
//   2. The Silo's rows are built on the server. Every business shows by name
//      (ticket 171b), but amounts and counts stay server-side below the bar.
//   3. A failed read says so, with a way to try again, instead of drawing an
//      empty map.
//   4. The 3D scene is its own lazy chunk, with the list as the fallback.
//   5. The six a11y fixes from the round 17 review.
//
// Parsed from source because vitest runs environment: 'node' with no jsdom and
// the page is a Server Component that cannot be rendered here, the same
// technique tests/aggregate-privacy.test.ts and tests/spend-vocabulary.test.ts
// use. The naming and floor rules themselves are unit-tested in
// tests/silo-layout.test.ts.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

function read(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8')
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const PAGE = 'app/(public)/flow-map/page.tsx'
const SILO = 'components/flow-map/silo'
const EXPERIENCE = `${SILO}/SiloExperience.tsx`
const PANELS = `${SILO}/SiloPanels.tsx`
const LIST = `${SILO}/SiloList.tsx`
const MORE = `${SILO}/SiloMore.tsx`
const SCENE = `${SILO}/SiloScene.tsx`
const SUPPORT = `${SILO}/use-silo-support.ts`

describe('/flow-map data reads', () => {
  const page = read(PAGE)

  it('gates every flow_nodes read at the shared threshold', () => {
    const reads = page.match(/\.from\('flow_nodes'\)/g) ?? []
    const gates = page.match(/\.gte\('transaction_count', AGGREGATE_MIN_TRANSACTIONS\)/g) ?? []
    expect(reads.length).toBeGreaterThan(0)
    expect(gates.length).toBe(reads.length)
  })

  it('counts only receipts that stay in community figures', () => {
    expect(page).toMatch(/\.from\('spend_events'\)[\s\S]{0,120}\.eq\('aggregate_opt_out', false\)/)
  })

  it("marks the reader's dots only from counted, approved receipts", () => {
    expect(page).toMatch(/r\.status === 'approved' && !r\.aggregate_opt_out && r\.listing_id/)
  })

  it('builds the Silo rows on the server, every business by name (ticket 171b)', () => {
    expect(page).toContain('buildSiloBusinesses(')
    expect(page).not.toContain('isNameOptedIn')
    // The client gets SiloBusiness rows, never the raw listing names.
    expect(read(EXPERIENCE)).not.toMatch(/from\('listings'\)/)
  })

  it('shows a failed read as a failure with a way to try again', () => {
    expect(page).toContain('We couldn&apos;t load The Collective.')
    expect(page).toMatch(/siloLoadFailed \?/)
    expect(page).toMatch(/href="\/flow-map"\s+prefetch=\{false\}[\s\S]{0,400}Try again/)
  })

  it('opens focused on the reader with ?you=1', () => {
    expect(page).toContain("focusYou={params.you === '1'}")
  })
})

describe('/flow-map retired surfaces', () => {
  const page = withoutComments(read(PAGE))

  it('no longer renders the filters, the SVG network or the summary cards', () => {
    expect(page).not.toMatch(/FlowMapFilters|FlowMapNetwork|FlowSummaryCards/)
    expect(page).toContain('<SiloExperience')
  })

  it('keeps FlowNodeTable for the list view and the fallback', () => {
    expect(read(LIST)).toContain('<FlowNodeTable')
  })
})

describe('Silo loading', () => {
  const experience = read(EXPERIENCE)

  it('loads the scene as its own chunk, only after mount', () => {
    expect(experience).toContain("import('./SiloScene')")
    // A static import would pull three into the page's first JS.
    expect(experience).not.toMatch(/import\s+SiloScene\s+from/)
    expect(experience).toMatch(/import type \{ SiloSceneProps \} from '\.\/SiloScene'/)
  })

  it('falls back to the list when the chunk fails or the context is lost', () => {
    expect(experience).toContain('setChunkFailed(true)')
    expect(experience).toContain('setContextLost(true)')
    expect(experience).toContain('Try the map again')
    expect(read(SCENE)).toContain('webglcontextlost')
  })

  it('shows the list first on low-power devices, with a way to the map', () => {
    expect(read(SUPPORT)).toContain("'low-power'")
    expect(experience).toContain('Show the map anyway')
  })
})

describe('Silo motion and keys', () => {
  const experience = read(EXPERIENCE)

  it('has a visible Pause motion button and honors reduced motion', () => {
    expect(experience).toContain("'Pause motion'")
    expect(experience).toContain('usePrefersReducedMotion()')
    expect(experience).toMatch(/const motion = !paused && !reducedMotion/)
  })

  it('lets letter shortcuts be switched off and remembers it (a11y fix 2)', () => {
    expect(read(SUPPORT)).toContain("'silo-shortcuts'")
    expect(experience).toMatch(/if \(!shortcutsOn\) return/)
    expect(read(PANELS)).toContain('Letter shortcuts on')
  })

  it('keeps the key map closed by default (a11y fix 3)', () => {
    expect(experience).toMatch(/\[keysOpen, setKeysOpen\] = useState\(false\)/)
  })
})

describe('Silo a11y fixes', () => {
  it('makes More a real modal: inert rest, trapped focus, focus returned (fix 1)', () => {
    const more = read(MORE)
    expect(more).toContain('aria-modal="true"')
    expect(more).toContain('.inert = true')
    expect(more).toMatch(/returnTo\?\.focus\(\)/)
  })

  it('reads each floor amount aloud (fix 4)', () => {
    expect(read(PANELS)).toMatch(/aria-label=\{`\$\{floorSpokenLabel\(/)
  })

  it('has one screen reader status line (fix 5)', () => {
    const experience = read(EXPERIENCE)
    expect(experience.match(/role="status"/g)?.length).toBe(1)
  })

  it('drops the n of N click-through from the card (ticket 171b)', () => {
    const panels = read(PANELS)
    expect(panels).not.toContain('Previous business')
    expect(panels).not.toContain('Next business')
    expect(panels).not.toContain('ctx-nav')
  })

  it('hides the canvas from screen readers', () => {
    expect(read(SCENE)).toContain('aria-hidden')
  })
})

describe('Silo copy', () => {
  it('never calls the spend "circulated"', () => {
    for (const file of [EXPERIENCE, PANELS, LIST, MORE]) {
      expect(withoutComments(read(file)), file).not.toMatch(/circulat/i)
    }
  })

  it('uses no em dashes in reader-facing Silo copy', () => {
    for (const file of [EXPERIENCE, PANELS, LIST, MORE]) {
      expect(withoutComments(read(file)), file).not.toContain('—')
    }
  })
})
