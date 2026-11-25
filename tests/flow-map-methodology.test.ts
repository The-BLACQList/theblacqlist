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
// tests/flow-map-page.test.ts already use.
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
import {
  canViewReceiptFile,
  maskBuyerName,
  needsAdminReview,
  ownerCanReview,
} from '@/lib/spend/owner-receipts'
import { parseReceiptFields } from '@/lib/spend/receipt-input'

function read(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8')
}

const METHODOLOGY = 'app/(public)/flow-map/methodology/page.tsx'
const FLOW_MAP = 'app/(public)/flow-map/page.tsx'
// Ticket 171 moved the flow map's notes: the method link sits in the hero and
// beside the map, and the privacy notes live on the methodology page itself.
const FIRST_LOOK = 'components/flow-map/CollectiveFirstLook.tsx'
const SILO = 'components/flow-map/silo/SiloExperience.tsx'
const NOTE = 'docs/blacqlist/flow-map/data-sourcing-and-methodology.md'
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
    expect(read(FIRST_LOOK)).toContain('href="/flow-map/methodology"')
    expect(read(SILO)).toContain('href="/flow-map/methodology"')
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
    expect(copy).toContain('The community-wide totals are not held to that rule.')
  })
})

describe('the false opt-out claim is gone from the flow map', () => {
  it('no longer promises an opt-out "at any time"', () => {
    // The window closes at approval. The old sentence here was the same defect
    // class this page exists to prevent: a confident claim not backed by code.
    for (const file of [FLOW_MAP, FIRST_LOOK, SILO, METHODOLOGY]) {
      expect(read(file)).not.toContain('opt out of community aggregates at any time')
    }
  })

  it('describes the choice that does exist, at the moment it exists', () => {
    expect(renderedCopy(METHODOLOGY)).toContain('When you add a receipt you can choose to keep it')
  })

  // Still deliberately NOT asserted here: that app/(public)/privacy/page.tsx
  // and app/(public)/terms/page.tsx carry the same correction. The reason has
  // changed, so it is worth stating precisely.
  //
  // When this file was written the decision had not been taken. It has been
  // since [Decision — founder, 2026-08-17: "B — correct the copy"], and the
  // correction exists: all three sentences are rewritten and guarded by
  // tests/opt-out-copy.test.ts. But that work sits on an unmerged branch,
  // held on [Needs professional review] — a Privacy Policy and a Terms of
  // Service narrowing a stated data right is a change counsel reads before it
  // ships, not one a green build clears.
  //
  // So on main today both documents still carry the false claim — privacy
  // §4/§8 as "at any time through your account settings", terms §6 as the
  // account-wide shape alone ("unless you opt out in your account settings"),
  // which is why the fix guards both halves separately rather than banning one
  // phrase. Asserting the correction here would redden CI over copy that has
  // not landed. When it lands, opt-out-copy.test.ts is where the guard lives —
  // do not duplicate it here.
})

describe('section 8 — the limitations a tidy-up would quietly delete', () => {
  it('exists at all', () => {
    const copy = renderedCopy(METHODOLOGY)
    expect(copy).toContain('id="gaps"')
    expect(copy).toContain('Where This Currently Falls Short')
  })

  it('still discloses that older per-business totals include opted-out spend', () => {
    const copy = renderedCopy(METHODOLOGY)
    expect(copy).toContain(
      'Older per-business and per-city totals may still include spend that was opted out.'
    )
    // The date the write-side fix landed. Without it the reader cannot tell
    // which figures are affected, which makes the disclosure unusable.
    expect(copy).toContain('From 16 August 2026')
    expect(copy).toContain('The community-wide totals have always honored the opt-out')
  })

  it('still discloses that the opt-out closes at approval', () => {
    const copy = renderedCopy(METHODOLOGY)
    expect(copy).toContain('The opt-out can be changed while a receipt is waiting for review')
    expect(copy).toContain('for as long as that receipt is still waiting or needs a fix')
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
    expect(action).toContain(".eq('status', existing.status)")
  })

  it('locks at approval with a message that matches what the page promises', () => {
    expect(read(EDIT_ACTION)).toContain(
      'This receipt has been approved and can no longer be edited.'
    )
    expect(renderedCopy(METHODOLOGY)).toContain('the receipt is locked')
  })
})

// ── Ticket 279: the page against the code it describes ─────────────────────
// Each case checks the rule in code first, then the sentence. If the rule
// changes, the first half fails and the sentence has to be looked at again.

/** The page's words with markup and line breaks flattened. */
function words(): string {
  return renderedCopy(METHODOLOGY)
    .replace(/\{' '\}/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&rsquo;/g, "'")
    .replace(/&[lr]dquo;/g, '"')
    .replace(/&mdash;/g, '-')
    .replace(/\s+/g, ' ')
}

describe('a receipt photo is required, and the page says so', () => {
  it('a new receipt without a photo is refused', () => {
    const parsed = parseReceiptFields(new FormData(), { requirePhoto: true })
    expect(parsed.ok).toBe(false)
    expect(!parsed.ok && parsed.fieldErrors?.receipt_file).toBeTruthy()
    expect(read('lib/actions/spend/createReceiptSubmission.ts')).toContain(
      'parseReceiptFields(formData, { requirePhoto: true })'
    )
  })

  it('an older receipt with no photo needs one when it is corrected', () => {
    expect(read(EDIT_ACTION)).toContain('!existing.file_path && !hasReceiptPhoto(fileField)')
  })

  it('the page and the note say required', () => {
    expect(words()).toContain('A photo or PDF of the receipt is required.')
    expect(words()).not.toMatch(/receipt is optional/)
    expect(read(NOTE)).toContain('A receipt image or PDF is **required**')
  })
})

describe('who approves a receipt', () => {
  const pending = { user_id: 'shopper', status: 'pending_review' }

  it('the business can approve, but never its own receipt', () => {
    const asOwner = { listingOwnerId: 'owner', viewerId: 'owner' }
    expect(ownerCanReview({ receipt: pending, ...asOwner })).toBe('ok')
    expect(ownerCanReview({ receipt: { ...pending, user_id: 'owner' }, ...asOwner })).toBe(
      'own_receipt'
    )
    expect(read('lib/actions/owner/verifyReceipt.ts')).toContain("role: 'owner'")
    expect(words()).toContain(
      'The business named on the receipt or our team can approve or reject it.'
    )
    expect(words()).toContain('An owner cannot approve a receipt submitted from their own account.')
  })

  it('our team has unclaimed businesses, and anything past the fallback', () => {
    const now = new Date('2026-11-24T12:00:00Z')
    const receipt = { listing_id: 'l', created_at: '2026-11-24T11:00:00Z' }
    expect(needsAdminReview(receipt, null, now)).toBe(true)
    expect(needsAdminReview(receipt, 'owner', now)).toBe(false)
    expect(words()).toContain(
      'any still waiting after {ADMIN_FALLBACK_DAYS} days, and can review any other.'
    )
    expect(read(METHODOLOGY)).toContain("from '@/lib/spend/owner-receipts'")
  })

  it('no sentence says only our team, or a lone reviewer, approves', () => {
    expect(words()).not.toMatch(/\breviewer\b/i)
    expect(words()).toContain('approved by the business it names or by a person on our team')
    expect(read(NOTE)).not.toMatch(/approved by an admin, is|an admin approves that receipt/)
  })

  it('says what an owner sees, and when the photo closes to them', () => {
    const owner = { viewerId: 'owner', isAdmin: false, listingOwnerId: 'owner' }
    const receipt = { user_id: 'shopper', listing_id: 'l' }
    const canView = (status: string) =>
      canViewReceiptFile({ ...owner, receipt: { ...receipt, status } })
    expect(canView('pending_review')).toBe(true)
    expect(canView('approved')).toBe(false)
    expect(canView('rejected')).toBe(false)
    expect(maskBuyerName('Jordan Smith')).toBe('Jordan S.')
    expect(words()).toContain(
      'its owner can see the photo, the amount, the date, and your first name and last initial.'
    )
    expect(words()).toContain('They can open the photo only until the receipt is reviewed.')
  })

  it('says a business may be confirming its own sale', () => {
    expect(words()).toContain('A business can be confirming its own sale.')
  })
})

describe('what the figures leave out', () => {
  it('an unlisted receipt is never approved, and no sentence says it counts', () => {
    expect(read('lib/spend/applyReceiptReview.ts')).toContain("reason: 'unlisted'")
    expect(words()).not.toContain('still counts toward the total')
    expect(words()).toContain('the receipt never counts toward a public figure')
  })

  it("discloses the map's Latest list, which shows a day and never an amount", () => {
    expect(read(FLOW_MAP)).toContain('when: dayLabel(r.created_at)')
    expect(words()).toContain('It never shows an amount or a shopper.')
  })

  it('does not promise that no single amount can be worked out', () => {
    expect(words()).toContain('could work out the amount of a single receipt')
    expect(words()).not.toMatch(/buy nobody any privacy|no path from a published figure/)
  })

  it('does not say the recalculation is scheduled, and does not say pages are an hour old', () => {
    expect(words()).not.toContain('which is scheduled')
    expect(words()).not.toContain('cached for an hour')
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
    expect(copy).toContain('Why We Do Not Say')
    expect(copy).toContain('It just does not get to label a number.')
  })
})
