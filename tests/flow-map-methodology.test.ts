// =============================================================================
// /flow-map/methodology — the public disclosure behind every spend figure
// =============================================================================
// The product publishes dollar figures about a community. The board's done-when
// for that work is "the impact page is live with real, defensible numbers", and
// a number is only defensible if a reader who doubts it can find out how it was
// built. An internal engineering doc does not do that job — only a published
// page does.
//
// A methodology page carries a risk an ordinary marketing page does not: it is
// quotable. Once someone cites it, a sentence that has quietly drifted away from
// the code is worse than no page at all. So this suite does not test that the
// page renders. It pins the four things that make it worth publishing:
//
//   1. The privacy promise in the copy is the same number as the one in the
//      query — interpolated, never typed.
//   2. The disclosure is reachable from the figures it explains. An unlinked
//      disclosure is not a disclosure.
//   3. Section 8, the limitations, still says both of the awkward things. That
//      is the section a future tidy-up deletes without noticing, because
//      deleting it makes the page read better.
//   4. The opt-out window described in prose is coupled to the guard in
//      lib/actions/spend/updateReceiptSubmission.ts that actually enforces it,
//      so widening the guard reddens the page.
//
// It also pins that internal vocabulary — table names, file paths, migration
// ids, evidence labels — has not leaked into reader-facing copy, which is the
// characteristic failure mode when a public page is adapted from an internal
// document. This one was.
//
// Parsed from source because vitest runs environment: 'node' with no jsdom and
// the page is a Server Component that cannot be rendered here — the technique
// tests/aggregate-privacy.test.ts, tests/spend-vocabulary.test.ts and
// tests/flow-map-filters.test.ts already use.
//
// Non-vacuity: this file and the page it guards are both new, so stashing
// proves nothing. Each assertion below was instead run against a deliberately
// mutated copy of the page and confirmed to fail
// [Measured — vitest, 2026-08-17]. The mutations are named in the PR body.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { AGGREGATE_MIN_TRANSACTIONS } from '@/lib/spend/aggregate-privacy'

function read(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8')
}

const METHODOLOGY = 'app/(public)/flow-map/methodology/page.tsx'
const FLOW_MAP = 'app/(public)/flow-map/page.tsx'
const EDIT_ACTION = 'lib/actions/spend/updateReceiptSubmission.ts'

/**
 * Everything the reader actually sees, with comments and imports removed.
 * The doc comment on the page deliberately names the internal companion doc
 * and the constant it imports; neither reaches a reader, so neither should
 * count against the leakage assertions below.
 */
function renderedCopy(file: string): string {
  const withoutComments = read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  const componentStart = withoutComments.indexOf('export default function')
  expect(componentStart).toBeGreaterThan(-1)
  return withoutComments.slice(componentStart)
}

describe('the disclosure is published, indexable, and reachable', () => {
  it('is a real public page, not a draft left unindexed', () => {
    const source = read(METHODOLOGY)
    expect(source).toContain('robots: { index: true, follow: true }')
    // Static: the methodology changes when the pipeline changes, in the same
    // PR, so there is nothing for a revalidation window to catch up with.
    expect(source).toContain('export const revalidate = false')
  })

  it('is linked from the figures it explains', () => {
    // A methodology nobody can reach from the numbers is a document, not a
    // disclosure. This is the assertion that keeps it a disclosure.
    expect(read(FLOW_MAP)).toContain('href="/flow-map/methodology"')
  })

  it('points back at the figures, so the two are navigable in both directions', () => {
    expect(renderedCopy(METHODOLOGY)).toContain('href="/flow-map"')
  })
})

describe('the privacy promise cannot drift from the query that enforces it', () => {
  it('interpolates the threshold rather than typing the number', () => {
    const source = read(METHODOLOGY)
    expect(source).toContain("from '@/lib/spend/aggregate-privacy'")
    expect(source).toContain('{AGGREGATE_MIN_TRANSACTIONS}')
  })

  it('does not also state the threshold as a literal, which is how the two diverge', () => {
    // If someone raises AGGREGATE_MIN_TRANSACTIONS, a hardcoded copy of the old
    // value here would turn this page into a false privacy promise — the one
    // kind of error a methodology page must not make.
    const stated = new RegExp(`${AGGREGATE_MIN_TRANSACTIONS}\\s+or more separate purchases`)
    expect(renderedCopy(METHODOLOGY)).not.toMatch(stated)
  })

  it('states the promise the threshold actually buys', () => {
    const copy = renderedCopy(METHODOLOGY)
    expect(copy).toContain('or more separate purchases')
    // The community-wide figures are deliberately ungated. Saying so is the
    // difference between a threshold and an inconsistency.
    expect(copy).toContain('deliberately not held to that rule')
  })
})

describe('the false opt-out claim is gone from the flow map', () => {
  it('no longer promises an opt-out "at any time"', () => {
    // The window closes at approval. The old sentence here was the same defect
    // class this page exists to prevent: a confident claim not backed by code.
    expect(read(FLOW_MAP)).not.toContain('opt out of community aggregates at any time')
  })

  it('describes the choice that does exist, at the moment it exists', () => {
    expect(read(FLOW_MAP)).toContain('When you submit a receipt you can choose to keep it')
  })

  // Deliberately NOT asserted here: that app/(public)/privacy/page.tsx and
  // app/(public)/terms/page.tsx carry the same correction. Both still say
  // "at any time … from your account settings". They are a Privacy Policy and
  // a Terms of Service — a founder decision with [Needs professional review],
  // not a copy fix this PR may make unilaterally. Guarding them here would
  // redden CI over a decision that has not been taken yet. It is filed.
})

describe('section 8 — the limitations a tidy-up would quietly delete', () => {
  it('exists at all', () => {
    const copy = renderedCopy(METHODOLOGY)
    expect(copy).toContain('id="gaps"')
    expect(copy).toContain('Where this currently falls short')
  })

  it('still discloses that older per-business totals include opted-out spend', () => {
    const copy = renderedCopy(METHODOLOGY)
    expect(copy).toContain(
      'Older per-business and per-city totals still include spend that was opted out.'
    )
    // The date the write-side fix landed. Without it the reader cannot tell
    // which figures are affected, which makes the disclosure unusable.
    expect(copy).toContain('From 16 August 2026')
    expect(copy).toContain('The community-wide totals at the top of the page have always')
  })

  it('still discloses that the opt-out closes at approval', () => {
    const copy = renderedCopy(METHODOLOGY)
    expect(copy).toContain('The opt-out can be changed while a receipt is waiting for review')
    expect(copy).toContain('for as long as that receipt is still pending')
    expect(copy).toContain('spend that has already been counted')
  })

  it('gives the reader somewhere to go when the product cannot serve them', () => {
    // A limitation with no exit is a shrug. The manual path is the exit — and
    // it has to be inside section 8, not merely somewhere on the page, or this
    // assertion survives section 8 being deleted.
    const copy = renderedCopy(METHODOLOGY)
    const section = copy.slice(copy.indexOf('id="gaps"'), copy.indexOf('id="deletion"'))
    expect(section).toContain('href="/contact"')
  })
})

describe('the stated opt-out window is coupled to the guard that enforces it', () => {
  it('is enforced by a status guard, not by the form alone', () => {
    const action = read(EDIT_ACTION)
    expect(action).toContain('aggregate_opt_out')
    // Read-time guard and write-time re-assertion. Either one alone is a race.
    expect(action).toContain("existing.status !== 'pending_review'")
    expect(action).toContain(".eq('status', 'pending_review')")
  })

  it('locks at approval with a message that matches what the page promises', () => {
    expect(read(EDIT_ACTION)).toContain('This receipt has been approved and can no longer be edited.')
    expect(renderedCopy(METHODOLOGY)).toContain('the receipt is locked')
  })
})

describe('internal vocabulary has not leaked into reader-facing copy', () => {
  it('names no table, column, file, or migration', () => {
    const copy = renderedCopy(METHODOLOGY)
    for (const internal of [
      'spend_events',
      'flow_nodes',
      'flow_edges',
      'aggregate_opt_out',
      'receipt_uploads',
      'supabase',
      '.sql',
      'lib/',
      'docs/blacqlist',
      'RLS',
    ]) {
      expect(copy).not.toContain(internal)
    }
  })

  it('carries no evidence labels, which are an internal convention', () => {
    const copy = renderedCopy(METHODOLOGY)
    expect(copy).not.toContain('[Measured')
    expect(copy).not.toContain('[Assumption]')
    expect(copy).not.toContain('[Unknown]')
    expect(copy).not.toContain('[Recommendation]')
  })

  it('keeps the vocabulary discipline it is explaining', () => {
    const copy = renderedCopy(METHODOLOGY)
    // The page is the one surface allowed to use the word, because explaining
    // why we avoid it requires saying it. What it may not do is attach it to a
    // figure — hence the explicit refusal, which tests/spend-vocabulary.test.ts
    // enforces everywhere else.
    expect(copy).toContain('Why we do not say')
    expect(copy).toContain('It just does not get to label a number.')
  })
})
