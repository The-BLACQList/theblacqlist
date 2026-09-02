// =============================================================================
// Tester Tour — render-mode contract on the three witness pages (M4.9)
// =============================================================================
// The tour's evidence comes from witnesses that run inside real page renders.
// That only works if the pages actually render per-request — and all three do,
// but for a reason that lives nowhere near their own source: PublicHeader
// reads cookies in the root layout, which makes every route dynamic. Two of
// the pages (listing, collection) used to declare `export const revalidate =
// 3600` anyway. The declaration was dead — production served them dynamically
// regardless — but a dead declaration is worse than none, because the next
// reader (or the next refactor that moves the cookie read) trusts it.
//
// M4.9 removed both declarations and left a comment saying why none is
// declared. These tests keep that true. They are source-text assertions for
// the same reason tests/impact-report.test.ts:328-333 uses them: the failure
// mode is silent. Nothing breaks when a dead `revalidate` is re-copied from a
// sibling page — the page still renders, the witness still fires — the source
// just lies about the render mode again, and only a test notices.
//
// The witness-presence assertions exist for the inverse silence: deleting a
// <TourWitness> breaks no build and throws no error. A tester's step simply
// never completes, and the first symptom is a confused human days later.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), 'utf8')

const searchSrc = read('app/(public)/search/page.tsx')
const listingSrc = read('app/[citySlug]/[entityType]/[listingSlug]/page.tsx')
const collectionSrc = read('app/(public)/collections/[slug]/page.tsx')

// Anchored to the start of a line so a comment quoting the phrase while
// explaining its absence does not match. If one of these ever fails, delete
// the re-added declaration rather than loosening the assertion — see the
// header for why the declaration is dead on every route.
const REVALIDATE_DECLARATION = /^\s*export\s+const\s+revalidate/m

describe('search page (search_ran witness)', () => {
  it('declares no revalidate — it never had one, and must not gain one', () => {
    expect(searchSrc).not.toMatch(REVALIDATE_DECLARATION)
  })

  it('renders the search_ran witness', () => {
    expect(searchSrc).toContain('<TourWitness step="search_ran" />')
  })

  it('places the witness after the empty-query early return', () => {
    // Visiting /search with no query is not searching. The witness must sit
    // below the `if (!query)` return so an empty visit records nothing.
    const emptyQueryReturn = searchSrc.indexOf('if (!query)')
    const witness = searchSrc.indexOf('<TourWitness')
    expect(emptyQueryReturn).toBeGreaterThan(-1)
    expect(witness).toBeGreaterThan(emptyQueryReturn)
  })
})

describe('listing page (listing_opened witness)', () => {
  it('no longer declares the revalidate it could not honour', () => {
    expect(listingSrc).not.toMatch(REVALIDATE_DECLARATION)
  })

  it('records the witness with the ownership context', () => {
    // listing_opened must not count a tester opening their own listing. The
    // check lives inside recordTourWitness, but only if the page hands it the
    // owner — a bare call would silently count self-views.
    expect(listingSrc).toMatch(
      /recordTourWitness\('listing_opened',\s*\{\s*listingOwnerId:\s*entity\.owner_user_id\s*\}\)/
    )
  })
})

describe('collection page (collection_browsed witness)', () => {
  it('no longer declares the revalidate it could not honour', () => {
    expect(collectionSrc).not.toMatch(REVALIDATE_DECLARATION)
  })

  it('renders the collection_browsed witness inside its own Suspense boundary', () => {
    const witness = collectionSrc.indexOf('<TourWitness step="collection_browsed" />')
    expect(witness).toBeGreaterThan(-1)
    // The witness resolves the viewer (an auth round-trip when the flag is
    // on); Suspense isolation keeps that off the page shell's critical path.
    const suspenseOpen = collectionSrc.lastIndexOf('<Suspense', witness)
    const suspenseClose = collectionSrc.indexOf('</Suspense>', witness)
    expect(suspenseOpen).toBeGreaterThan(-1)
    expect(suspenseClose).toBeGreaterThan(witness)
  })

  it('emits COLLECTION_VIEWED — declared in constants.ts, emitted nowhere until M4.9', () => {
    expect(collectionSrc).toContain('ANALYTICS_EVENTS.COLLECTION_VIEWED')
    expect(collectionSrc).toContain('trackServerEvent(')
  })
})
