// =============================================================================
// Claim review SLA — the three public surfaces must promise the same thing
// =============================================================================
// A business owner submitting an ownership claim is told how long review takes
// three times, by three different files, within about two minutes: on the claim
// page before they submit, on the success screen after, and in the confirmation
// email that lands in their inbox.
//
// On 2026-09-13 those three disagreed. The page and the form said 3–5 business
// days; the email said 2–3. Nothing was broken — every file was internally
// correct, each read fine on its own, and no build, type check, or lint could
// see the problem, because the problem only exists in the gap between them.
// The first person positioned to notice was the owner waiting on the claim.
//
// These are source-text assertions for that reason: the failure mode is silent
// and distributed. Someone edits one file's copy, ships it, and the promise
// quietly forks again.
//
// If one of these fails, the fix is to make all three agree — not to loosen the
// assertion to whatever the newest file happens to say. To change the promise,
// change PUBLIC_CLAIM_SLA here and all three files in the same commit.
//
// The number itself: public copy says 3–5 business days; the internal SLA in
// docs/blacqlist/launch/on-call.md is 2 business days. That gap is deliberate
// and is not a bug — under-promise, over-deliver `[Decision — founder,
// 2026-09-13]`. Do not "fix" it by tightening the public number to match.
//
// Note the en dash. The copy uses 3–5 (U+2013), not 3-5.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), 'utf8')

const PUBLIC_CLAIM_SLA = '3–5 business days'

// Every place the claim-review turnaround is promised to an owner.
const CLAIM_SLA_SURFACES: ReadonlyArray<readonly [label: string, file: string]> = [
  ['claim page (before submitting)', 'app/(public)/claim/[listingId]/page.tsx'],
  ['claim form success screen', 'components/claim/ClaimForm.tsx'],
  ['claim-submitted email', 'lib/email/templates/claim-submitted.tsx'],
]

describe('claim review SLA copy', () => {
  it.each(CLAIM_SLA_SURFACES)('%s promises "3–5 business days"', (_label, file) => {
    expect(read(file)).toContain(PUBLIC_CLAIM_SLA)
  })

  it.each(CLAIM_SLA_SURFACES)('%s states no competing turnaround', (_label, file) => {
    const src = read(file)
    // Any "N business day(s)" phrasing that is not the agreed one. Catches the
    // original drift (2–3) and a future single-number rewrite (48 hours is
    // covered separately below).
    const durations = src.match(/\d+(?:[–-]\d+)?\s+business\s+days?/g) ?? []
    const competing = durations.filter((d) => d !== PUBLIC_CLAIM_SLA)
    expect(competing).toEqual([])
  })

  it.each(CLAIM_SLA_SURFACES)('%s does not promise a turnaround in hours', (_label, file) => {
    // The internal SLA is measured in hours; the public promise is not. A file
    // here reaching for hours means the internal number leaked into user copy.
    expect(read(file)).not.toMatch(/\d+\s*(?:hours|hrs)\b/i)
  })
})
