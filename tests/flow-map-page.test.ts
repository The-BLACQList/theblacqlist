// =============================================================================
// /flow-map page: the Silo (ticket 167)
// =============================================================================
// Ticket 167 replaced the city/category filters, the SVG network and the
// summary cards with the Silo. This suite pins what the page must keep doing
// through that change, and the a11y and loading rules the Silo adds:
//
//   1. Every named per-business or per-city figure stays gated at
//      AGGREGATE_MIN_TRANSACTIONS (lines show from LINK_MIN_TRANSACTIONS,
//      ticket 250), and the community total still leaves out
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

  it('gates every flow_nodes read at a shared threshold', () => {
    const reads = page.match(/\.from\('flow_nodes'\)/g) ?? []
    const gates =
      page.match(/\.gte\('transaction_count', (AGGREGATE|LINK)_MIN_TRANSACTIONS\)/g) ?? []
    expect(reads.length).toBeGreaterThan(0)
    expect(gates.length).toBe(reads.length)
  })

  // Ticket 250: business lines from 1 receipt; every figure the page publishes
  // directly (cities) stays at the aggregate bar. buildSiloBusinesses zeroes
  // the business figures under it (tests/silo-layout.test.ts).
  it('reads business nodes at the line bar and city nodes at the total bar', () => {
    expect(page).toMatch(
      /\.eq\('node_type', 'business'\)\s*\.gte\('transaction_count', LINK_MIN_TRANSACTIONS\)/
    )
    expect(page).toMatch(
      /\.eq\('node_type', 'city'\)\s*\.gte\('transaction_count', AGGREGATE_MIN_TRANSACTIONS\)/
    )
    expect(page).toContain('buildSiloBusinesses(')
  })

  it("draws the reader's pending line only from their own receipts in review", () => {
    expect(page).toMatch(/r\.status === 'pending_review' && !r\.aggregate_opt_out && r\.listing_id/)
    expect(page).toMatch(/\.from\('receipt_uploads'\)[\s\S]{0,160}\.eq\('user_id', user\.id\)/)
    expect(page).toContain('youPendingIds,')
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
    expect(page).toMatch(/href="\/flow-map"\s+prefetch=\{false\}[\s\S]{0,400}Try Again/)
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
    expect(experience).toMatch(/import type \{ SiloNav, SiloSceneProps \} from '\.\/SiloScene'/)
  })

  it('falls back to the list when the chunk fails or the context is lost', () => {
    expect(experience).toContain('setChunkFailed(true)')
    expect(experience).toContain('setContextLost(true)')
    expect(experience).toContain('Try the Map Again')
    expect(read(SCENE)).toContain('webglcontextlost')
  })

  it('shows the list first on low-power devices, with a way to the map', () => {
    expect(read(SUPPORT)).toContain("'low-power'")
    expect(experience).toContain('Show the Map Anyway')
  })
})

describe('Silo motion and keys', () => {
  const experience = read(EXPERIENCE)

  it('has a visible Pause motion button and honors reduced motion', () => {
    expect(experience).toContain("'Pause Motion'")
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

// Ticket 247: the page is the map. No light hero, an opening title, Recenter.
describe('/flow-map cinematic page (ticket 247)', () => {
  const page = read(PAGE)
  const experience = read(EXPERIENCE)

  it('is dark end to end, with no light hero band', () => {
    expect(page).not.toContain('bg-pale-lavender')
    expect(page).toContain('bg-deep-bg')
  })

  it('keeps the headline as the page h1 and plays it over the map', () => {
    expect(page).toMatch(/<h1 className="sr-only">\{headline\}<\/h1>/)
    expect(page).toContain('headline={headline}')
    expect(experience).toMatch(/className="silo-intro" aria-hidden="true" inert/)
  })

  it('skips the opening for reduced motion, a reload partway down and ?you=1', () => {
    expect(experience).toContain('introPlays({')
    expect(read(`${SILO}/silo.css`)).toMatch(
      /prefers-reduced-motion: reduce\) \{\s*\.silo-intro \{\s*display: none;/
    )
  })

  it('moves How It Works under the map and into More', () => {
    expect(page).toContain('<CollectiveHowItWorks')
    expect(page).toContain('steps={<FirstLookSteps layout="sheet" />}')
    expect(experience).toContain('<h4>How It Works</h4>')
  })

  it('recenters from a button, the R key and a double-click on empty space', () => {
    expect(experience).toMatch(/className="recenter"/)
    expect(experience).toMatch(/k === 'r' && showScene\) recenter\(\)/)
    expect(read(SCENE)).toContain("addEventListener('dblclick', onDoubleClick)")
    expect(read(PANELS)).toContain('<kbd>R</kbd>')
  })

  it('says a line shows from one receipt, not from the total bar', () => {
    expect(experience).not.toMatch(/A line appears once a business has at least/)
    expect(experience).toContain('A line appears once a business has one')
  })
})

// Ticket 248: on a phone the page shows a preview; full-screen owns the gestures.
describe('/flow-map phone full-screen (ticket 248)', () => {
  const experience = read(EXPERIENCE)
  const scene = read(SCENE)
  const css = read(`${SILO}/silo.css`)

  it('opens from an Enter The Collective button and closes with Back or X', () => {
    expect(experience).toContain('Enter The Collective')
    expect(experience).toContain('window.history.pushState(')
    expect(experience).toContain("addEventListener('popstate', onPop)")
    expect(experience).toContain('aria-label="Close Full Screen"')
  })

  it('only goes full-screen on a phone-sized window', () => {
    expect(experience).toContain('const full = fullAsked && compact')
    expect(read(SUPPORT)).toContain('export const COMPACT_QUERY')
  })

  it('locks the page, hands the canvas every gesture and returns focus', () => {
    expect(css).toMatch(/html\.silo-full-lock body \{\s*overflow: hidden;/)
    expect(css).toMatch(/\[data-full\] \.silo-stage canvas \{\s*touch-action: none;/)
    expect(css).toMatch(/\[data-full\] \.silo \{[^}]*height: 100dvh;/)
    expect(experience).toContain('enterBtnRef.current?.focus(')
  })

  it('takes no gestures in the page preview, so the page still scrolls', () => {
    expect(css).toMatch(/:not\(\[data-full\]\) \.silo-stage canvas \{\s*pointer-events: none;/)
    expect(scene).toContain('PREVIEW_SPIN * dt')
  })

  it('pinches to zoom in full-screen', () => {
    expect(scene).toContain('pinchZoom(')
  })

  it('rides up and down freely in full-screen, at eye height, and looks with two fingers', () => {
    expect(scene).toContain('swipeTravel(dy, el.clientHeight)')
    // Ticket 270: no pull to a floor; the glide carries on and stops.
    expect(scene).not.toContain('swipeLanding')
    expect(scene).toContain('rideCoast(r.t, r.glide, dt)')
    expect(scene).toContain('rideOrbit(r.t, r.az, r.pitch, shape)')
    expect(scene).toContain('lookTurn(midY - pinch.midY, el.clientHeight)')
    expect(experience).toContain('Swipe to ride and turn. Two fingers to look up or down.')
  })

  // Ticket 268: turning was hard on an iPhone. The top of the screen took the
  // finger, and a thumb's arcing start often picked floors instead of turning.
  it('lets a finger through the title, figures and ticker to the map', () => {
    expect(css).toMatch(
      /\[data-full\] \.hud > :is\(\.brand, \.kpis, \.ticker\) \{\s*pointer-events: none;/
    )
    expect(css).toMatch(
      /\[data-full\] \.hud > :is\(\.brand, \.kpis, \.ticker\) :is\(a, button\) \{\s*pointer-events: auto;/
    )
  })

  it('lets an arcing swipe change its mind and undoes the first stretch', () => {
    expect(scene).toContain('if (far < SWIPE.lockPx) return')
    expect(scene).toContain('if (far >= SWIPE.settlePx) down.settled = true')
    expect(scene).toContain("if (down.axis === 'x') down.turned.az = down.az0")
    expect(scene).toContain("if (down.axis === 'y') r.t = down.t0")
    expect(scene).toContain('swipeTurnRate(el.clientWidth, DRAG_TURN)')
  })

  it("never resizes the canvas when Safari's bars come and go", () => {
    expect(css).toMatch(/\[data-full\] \.silo-stage \{\s*bottom: auto;\s*height: calc\(100lvh/)
  })
})

// Ticket 249: a sample map while real activity is thin, with a Demo / Live switch.
describe('/flow-map demo mode (ticket 249)', () => {
  const page = read(PAGE)
  const experience = read(EXPERIENCE)
  const scene = read(SCENE)
  const css = read(`${SILO}/silo.css`)

  it('picks the opening view on the server from ?view, the cookie and the real count', () => {
    expect(page).toContain('const initialView = pickView({')
    expect(page).toContain('.get(VIEW_COOKIE)?.value')
    expect(page).toContain('initialView={initialView}')
  })

  it('shows a Demo / Live switch and remembers the choice', () => {
    expect(experience).toContain("aria-pressed={view === 'demo'}")
    expect(experience).toContain("aria-pressed={view === 'live'}")
    expect(experience).toContain('rememberView(next)')
  })

  it('labels the sample for as long as Demo is on', () => {
    expect(experience).toContain('<b>{SAMPLE_BADGE}</b>')
    expect(experience).toContain('{SAMPLE_NOTE}')
    expect(experience).toContain('DEMO_INTRO_LINE')
  })

  it('builds the sample in the browser and never writes it anywhere', () => {
    expect(experience).toContain('buildDemoCollective()')
    expect(withoutComments(experience)).not.toMatch(/\bfetch\(|\.from\('|\.insert\(|\.rpc\(/)
  })

  it('grows a new sample line every few seconds', () => {
    expect(experience).toContain('arrivals={arriving}')
    expect(scene).toContain('demoArrivalAt(Date.now(), links.length)')
  })

  it('shows businesses buying from businesses, and the trail, in Demo only', () => {
    expect(experience).toContain('supply={demo?.supply}')
    expect(experience).toContain('trail={activeTrail}')
    expect(scene).toContain('<SupplyLinks')
    expect(scene).toContain('<TrailPath')
  })

  it('offers Follow a Dollar in Demo, with a card that steps and ends', () => {
    const panels = read(`${SILO}/SiloPanels.tsx`)
    expect(experience).toMatch(/\{demo && showScene && \(\s*<button[\s\S]*?className="dollar"/)
    expect(experience).toContain('aria-pressed={!!activeTrail}')
    expect(experience).toContain('else if (activeTrail) endTrail()')
    expect(panels).toContain("{last ? 'Follow Another Dollar' : 'Next Stop'}")
    expect(panels).toContain('End Trail')
    expect(panels).toContain("TRAIL_NOTE = 'Sample trail. Not real businesses or spending.'")
    // The trail holds still when motion is paused or the device asks for less.
    expect(experience).toMatch(
      /!motion \|\| !active\) return\s*const t = window\.setTimeout\(\(\) => nextStopRef/
    )
  })

  it('lets the sideways preview map reach the right edge', () => {
    expect(css).toMatch(
      /\.silo-track\[data-mode='map'\]:not\(\[data-full\]\) \.silo-stage \{\s*right: 0;/
    )
  })
})

describe('/flow-map no black hole while moving (ticket 267)', () => {
  const scene = read(SCENE)

  it('clamps every shader pow base, so Apple GPUs never get a NaN', () => {
    const pows = scene.match(/\bpow\((?!\s*clamp\()[^\n]*/g) ?? []
    expect(pows).toEqual([])
    expect(scene).toContain(
      'pow(clamp(1.0 - dot(safeNormalize(vN), safeNormalize(vV)), 0.0, 1.0), 2.2)'
    )
    expect(scene).toContain('return v / max(length(v), 1e-6);')
  })

  it('stops a bad pixel before the glow can spread it', () => {
    expect(scene).toMatch(
      /addPass\(new RenderPass\(scene, camera\)\)[\s\S]*?addPass\(new ShaderPass\(NAN_GUARD\)\)[\s\S]*?addPass\(bloom\)/
    )
    expect(scene).toContain('any(isnan(c)) || any(isinf(c))')
  })
})
