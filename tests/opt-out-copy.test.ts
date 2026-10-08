// =============================================================================
// The public opt-out claim — Privacy Policy and Terms of Service
// =============================================================================
// Three public sentences described a feature the product does not have: an
// aggregation opt-out available "at any time" from account settings. What the
// code provides is a per-receipt choice that can be changed while the receipt is
// pending review and locks the moment a reviewer approves it
// (lib/actions/spend/updateReceiptSubmission.ts).
//
// That gap matters more here than it would in marketing copy. A Privacy Policy
// and a Terms of Service are the documents a user is told to rely on, and a
// data right stated more broadly than the system delivers is the kind of claim
// a regulator or a plaintiff reads back to you. The correction was made under
// [Decision — founder, 2026-08-17: "B — correct the copy"], with the founder's
// condition that it carries [Needs professional review] before it ships.
//
// This suite exists because the correction is fragile in a specific way: the
// wrong sentence reads better. "Opt out at any time" is shorter, friendlier, and
// exactly what a future copy pass would restore without checking whether the
// product had caught up. So the assertions below pin three things:
//
//   1. Neither document promises "at any time", and neither promises an
//      account-wide setting. Both are the false shape, not just the old words.
//   2. Both describe the window that does exist, in the same terms as each
//      other — a per-receipt choice, changeable until approval.
//   3. That description is coupled to the guard that enforces it. If someone
//      widens the guard to allow edits after approval, the policy pages go red
//      rather than silently becoming understated.
//
// Parsed from source: vitest runs environment: 'node' with no jsdom and both
// pages are Server Components — the technique tests/aggregate-privacy.test.ts,
// tests/spend-vocabulary.test.ts and tests/flow-map-filters.test.ts use.
//
// Non-vacuity: unlike a suite written alongside brand-new code, both pages
// predate this change, so the honest check is available and was run.
// `git stash push -- "app/(public)/privacy/page.tsx" "app/(public)/terms/page.tsx"`
// restores the false copy and reddens 9 of the 11 cases below
// [Measured — vitest, 2026-08-17]. The two survivors are survivors on purpose:
//
//   - The guard coupling is about lib/, not about either page, so stashing the
//     pages cannot move it. It was checked separately by widening the status
//     guard in updateReceiptSubmission.ts, which reddens it.
//   - "Terms §6 does not offer an opt-out at any time" passed against the old
//     copy because the Terms bullet never said "at any time" — its version of
//     the false claim was the account-wide-setting shape alone ("unless you opt
//     out in your account settings"). The sibling case that forbids that shape
//     did go red. Both are asserted at all three sites anyway, because the two
//     halves of the claim have already proven able to travel independently.
// =============================================================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const PRIVACY = 'app/(public)/privacy/page.tsx'
const TERMS = 'app/(public)/terms/page.tsx'
const EDIT_ACTION = 'lib/actions/spend/updateReceiptSubmission.ts'

function read(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8')
}

/**
 * Only what a reader sees. Both pages carry a [Needs professional review] JSX
 * comment that quotes the false claim verbatim in order to explain why it was
 * removed — so a naive substring search over the raw file would find the very
 * phrase these tests exist to forbid, and pass for the wrong reason.
 */
function renderedCopy(file: string): string {
  return read(file)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s+/g, ' ')
}

/**
 * The passage between two section anchors.
 *
 * Scoping matters more than it looks. "at any time" and "through your account
 * settings" are both perfectly true elsewhere on these pages — you really can
 * delete your account at any time from account settings, and we really may
 * revise the Terms at any time. A page-wide ban on those words would forbid
 * true sentences and, worse, would train the next person to route around the
 * test rather than fix the claim. What is being pinned is the false statement
 * about aggregation, not the vocabulary.
 */
function passage(file: string, fromId: string, toId: string): string {
  const copy = renderedCopy(file)
  const start = copy.indexOf(`id="${fromId}"`)
  const end = copy.indexOf(`id="${toId}"`)
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return copy.slice(start, end)
}

/** The three passages that carried the false claim, and only those. */
const CLAIM_SITES: Array<[label: string, passage: () => string]> = [
  ['Privacy §4 Receipt and Spend Data', () => passage(PRIVACY, 'receipt-data', 'information-sharing')],
  ['Privacy §8 Your Rights', () => passage(PRIVACY, 'your-rights', 'security')],
  ['Terms §6 Receipt and Spend Data', () => passage(TERMS, 'receipt-data', 'prohibited-uses')],
]

describe('neither policy document promises an opt-out the product does not have', () => {
  it.each(CLAIM_SITES)('%s does not offer an opt-out "at any time"', (_label, get) => {
    expect(get()).not.toContain('at any time')
  })

  it.each(CLAIM_SITES)('%s does not point at an account-wide setting', (_label, get) => {
    // The false claim was not only "at any time" — it was also "your account
    // settings", a single switch for all of a user's spend. Forbidding the
    // adverb without forbidding the shape would let the same promise return in
    // different words.
    const copy = get()
    expect(copy).not.toContain('opt out in your account settings')
    expect(copy).not.toContain('from your account settings')
    expect(copy).not.toContain('through your account settings')
  })
})

describe('both documents describe the window that does exist', () => {
  it('the Privacy Policy scopes the choice to the individual receipt', () => {
    const copy = renderedCopy(PRIVACY)
    expect(copy).toContain('belongs to each receipt individually')
    expect(copy).toContain('for as long as that receipt is still awaiting review')
    expect(copy).toContain('Once a reviewer approves a receipt, its choice is')
  })

  it('the Privacy Policy states the two limits plainly rather than implying them', () => {
    const copy = renderedCopy(PRIVACY)
    expect(copy).toContain('There is no account-wide setting')
    expect(copy).toContain('no automated way to withdraw spend that has already')
  })

  it('the Privacy Policy gives the reader a path when the product cannot serve them', () => {
    // A narrowed right with no exit is worse than the overstatement it replaced.
    // The manual path is what makes the correction defensible, so it is pinned
    // inside section 4 rather than merely somewhere on a page that mentions the
    // same address five times.
    const section = passage(PRIVACY, 'receipt-data', 'information-sharing')
    expect(section).toContain('we will process the request by hand')
    expect(section).toContain('privacy@theblacqlist.com')
  })

  it('the rights list and the Terms agree with section 4 instead of contradicting it', () => {
    // Three surfaces, one fact. The rights bullet and the Terms consent bullet
    // are where the old claim survived after the product copy was fixed; this
    // is the assertion that stops them drifting apart again.
    expect(renderedCopy(PRIVACY)).toContain('until that receipt is approved')
    expect(renderedCopy(TERMS)).toContain('before it is approved')
    for (const file of [PRIVACY, TERMS]) {
      expect(renderedCopy(file)).toContain('Account &rarr; Receipts')
    }
  })
})

describe('the described window is coupled to the guard that enforces it', () => {
  it('locks at approval in code, which is what both documents now claim', () => {
    const action = read(EDIT_ACTION)
    expect(action).toContain('aggregate_opt_out')
    // Read-time guard and write-time re-assertion. Either one alone is a race,
    // and either one alone would make the policy pages optimistic.
    expect(action).toContain("existing.status !== 'pending_review'")
    expect(action).toContain(".eq('status', 'pending_review')")
  })
})
