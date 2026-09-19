// =============================================================================
// Review form identity follows the listing (founder walk, 2026-09-19)
// =============================================================================
// Walk A item 10: a review written with listing A in the URL landed on
// listing B, the one visited just before, and the success message named B.
//
// The fix has two halves, and this file pins both to source text:
//   * every client component between the page and the review form is keyed
//     by listing id, so no instance can outlive the listing it was made for
//     (page.tsx → EntityReviewsSection → ReviewFormDisclosure → ReviewForm)
//   * the success message names the listing the SERVER validated, returned by
//     createReviewAction, never a client-side prop that could be stale
//
// Only a browser can prove the Back behaviour; that is
// e2e/review-form-listing-identity.spec.ts. This file makes sure nobody quietly
// drops a key or reintroduces the prop in a refactor.
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), 'utf8')
}

const PAGE = read('app/[citySlug]/[entityType]/[listingSlug]/page.tsx')
const REVIEWS_SECTION = read('components/entity-page/EntityReviewsSection.tsx')
const DISCLOSURE = read('components/entity-page/ReviewFormDisclosure.tsx')
const FORM = read('components/entity-page/ReviewForm.tsx')
const ACTION = read('lib/actions/reviews/createReview.ts')

/** The opening tag of a JSX element, up to its closing `>` or `/>`. */
function openingTag(source: string, element: string): string {
  const start = source.indexOf(`<${element}`)
  expect(start, `<${element} not found`).toBeGreaterThan(-1)
  const end = source.indexOf('>', start)
  return source.slice(start, end + 1)
}

describe('every client boundary between the page and the review form is keyed by listing', () => {
  it('page.tsx keys <EntityTemplateOutlet> by entity.id', () => {
    expect(openingTag(PAGE, 'EntityTemplateOutlet')).toMatch(/\bkey=\{entity\.id\}/)
  })

  it('EntityReviewsSection keys <ReviewFormDisclosure> by entity.id', () => {
    expect(openingTag(REVIEWS_SECTION, 'ReviewFormDisclosure')).toMatch(/\bkey=\{entity\.id\}/)
  })

  it('ReviewFormDisclosure keys <ReviewForm> by listingId', () => {
    expect(openingTag(DISCLOSURE, 'ReviewForm')).toMatch(/\bkey=\{listingId\}/)
  })
})

describe('the success message names the listing the server validated', () => {
  it('ReviewForm takes no listingName prop', () => {
    const propsBlock = FORM.slice(FORM.indexOf('interface Props'), FORM.indexOf('}', FORM.indexOf('interface Props')))
    expect(propsBlock).not.toMatch(/listingName/)
    expect(FORM).toMatch(/export function ReviewForm\(\{ listingId, criteria = \[\] \}: Props\)/)
  })

  it('ReviewForm renders state.listingName in the success branch', () => {
    expect(FORM).toMatch(/Thanks for your review of \{state\.listingName\}\./)
  })

  it('ReviewFormDisclosure does not pass listingName down to the form', () => {
    expect(openingTag(DISCLOSURE, 'ReviewForm')).not.toMatch(/listingName=/)
  })

  it('createReviewAction selects the name from the validated row and returns it', () => {
    expect(ACTION).toMatch(/\.select\('id, name, owner_user_id, trust_tier'\)/)
    expect(ACTION).toMatch(/\{ success: true; reviewId: string; listingName: string \}/)
    expect(ACTION).toMatch(/return \{ success: true, reviewId: review\.id, listingName: listing\.name \}/)
  })
})

describe('anchors other guards rely on are untouched', () => {
  it('the hidden listing_id input is still what the action reads', () => {
    expect(FORM).toMatch(/<input type="hidden" name="listing_id" value=\{listingId\} \/>/)
    expect(ACTION).toMatch(/formData\.get\('listing_id'\)/)
  })

  it('the tour anchors on the disclosure survive', () => {
    expect(DISCLOSURE).toMatch(/id="write-review"/)
    expect(DISCLOSURE).toMatch(/data-tour="write-review"/)
    expect(FORM).toMatch(/id="review-body"/)
  })
})
