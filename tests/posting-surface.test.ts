// =============================================================================
// Posting surface — /events, /jobs, and every link into the two submit forms
// =============================================================================
// Debt ⑯: `/add-job` and `/add-event` had no inbound link anywhere in the app,
// and the two index pages that should have shown their output instead carried
// future-tense "launching in beta" copy and ran no query at all. Zero published
// jobs was therefore partly a measurement of nobody being able to find the
// page — not of nobody wanting to post.
//
// Both halves of that fix fail silently, which is why they are tested by source
// text rather than by rendering:
//
//   1. A link to `/add-event` or `/add-job` that is NOT gated on
//      `postingSubmissions` is a link to a 404 — both pages call notFound()
//      while the flag is off. Nothing breaks at build time; a visitor just
//      lands on a dead end. So: any file that renders one of those hrefs must
//      also read the flag.
//
//   2. A `revalidate` re-copied onto either index page from a sibling would be
//      dead on arrival (PublicHeader reads cookies in the root layout, so every
//      route is dynamic) and the page would keep working while its source lied
//      about the render mode. Same assertion, same reasoning, as
//      tests/tester-tour-render-mode.test.ts.

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p: string) => readFileSync(path.resolve(root, p), 'utf8')

const eventsSrc = read('app/(public)/events/page.tsx')
const jobsSrc = read('app/(public)/jobs/page.tsx')
const footerSrc = read('components/nav/public-footer.tsx')

// Anchored to line start so a comment explaining the absence cannot match.
const REVALIDATE_DECLARATION = /^\s*export\s+const\s+revalidate/m
const FLAG_READ = "isFeatureEnabled('postingSubmissions')"

/** Every .ts/.tsx under app/ and components/, excluding the two form pages. */
function sourceFiles(): string[] {
  const out: string[] = []
  for (const dir of ['app', 'components']) {
    for (const rel of readdirSync(path.resolve(root, dir), { recursive: true }) as string[]) {
      const file = path.posix.join(dir, rel.split(path.sep).join('/'))
      if (!/\.tsx?$/.test(file)) continue
      // The form pages own the hrefs' destinations; they gate themselves with
      // notFound() rather than by hiding a link, so they are not link sites.
      if (file.startsWith('app/add-event/') || file.startsWith('app/add-job/')) continue
      out.push(file)
    }
  }
  return out
}

describe('/events index page', () => {
  it('queries published event listings', () => {
    expect(eventsSrc).toContain("queryListings({ type: 'event'")
  })

  it('declares no revalidate it could not honour', () => {
    expect(eventsSrc).not.toMatch(REVALIDATE_DECLARATION)
  })

  it('renders its own empty state rather than the grid default', () => {
    // DiscoveryGrid's generic EmptyState says "No businesses found" with no
    // action — true for /discover, wrong and dead-ended here.
    expect(eventsSrc).toContain('No events posted yet')
  })

  it('separates a load failure from an empty directory', () => {
    // queryListings fails soft: a broken read returns zero rows. Without the
    // catch, an outage would render as "nothing posted yet" — untrue, and the
    // kind of untrue a visitor acts on by leaving.
    expect(eventsSrc).toMatch(/catch\b/)
    expect(eventsSrc).toContain("error=\"We couldn't load events just now.")
  })

  it('gives a page past the last result a way back instead of a way to post', () => {
    expect(eventsSrc).toContain('Nothing on this page')
    expect(eventsSrc).toContain('Back to the first page')
  })
})

describe('/jobs index page', () => {
  it('queries published job listings', () => {
    expect(jobsSrc).toContain("queryListings({ type: 'job'")
  })

  it('declares no revalidate it could not honour', () => {
    expect(jobsSrc).not.toMatch(REVALIDATE_DECLARATION)
  })

  it('renders its own empty state rather than the grid default', () => {
    expect(jobsSrc).toContain('No open roles right now')
  })

  it('separates a load failure from an empty board', () => {
    expect(jobsSrc).toMatch(/catch\b/)
    expect(jobsSrc).toContain("error=\"We couldn't load jobs just now.")
  })

  it('gives a page past the last result a way back instead of a way to post', () => {
    expect(jobsSrc).toContain('Nothing on this page')
    expect(jobsSrc).toContain('Back to the first page')
  })
})

describe('links into the submission forms', () => {
  it('finds the links at all — the whole point of ⑯ was that there were none', () => {
    const linking = sourceFiles().filter((f) => /href="\/add-(event|job)"/.test(read(f)))
    expect(linking.length).toBeGreaterThan(0)
  })

  it('gates every file that links to /add-event or /add-job on the flag', () => {
    // Both pages notFound() while FEATURE_POSTING_SUBMISSIONS is off, so an
    // ungated link is a link to a 404. Checked per file rather than per link:
    // a file reading the flag once and using it for several links is fine, a
    // file rendering the href with no flag read anywhere is not.
    const ungated = sourceFiles().filter((f) => {
      const src = read(f)
      return /href="\/add-(event|job)"/.test(src) && !src.includes(FLAG_READ)
    })
    expect(ungated).toEqual([])
  })

  it('offers both links from the footer when posting is on', () => {
    expect(footerSrc).toContain("href: '/add-event'")
    expect(footerSrc).toContain("href: '/add-job'")
  })

  it('reads the flag inside the component, not at module scope', () => {
    // `columns` is a module-level const, evaluated once at import. Appending
    // the two links there would freeze the flag at build time — the redeploy
    // that flips it would not change the footer.
    const columnsDecl = footerSrc.indexOf('const columns:')
    const flagRead = footerSrc.indexOf(FLAG_READ)
    const componentDecl = footerSrc.indexOf('export function PublicFooter()')
    expect(columnsDecl).toBeGreaterThan(-1)
    expect(flagRead).toBeGreaterThan(componentDecl)
  })
})

describe('footer navigation', () => {
  it('no longer labels Events and Jobs as coming soon', () => {
    // An `active: false` entry renders as a non-interactive span with an
    // sr-only " (coming soon)" suffix. Both pages work now, so announcing
    // that to a screen-reader user is simply false.
    expect(footerSrc).toContain("{ label: 'Events', href: '/events', active: true }")
    expect(footerSrc).toContain("{ label: 'Jobs', href: '/jobs', active: true }")
  })
})
