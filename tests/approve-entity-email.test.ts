// =============================================================================
// approveEntityAction — the approval email stays wired
// =============================================================================
// components/dashboard/PublishSection.tsx:113 promises every owner "You'll
// receive an email when it's approved." That promise was false from the day it
// shipped: rejectEntityAction sent an email, approveEntityAction sent nothing.
// Nothing failed. Nothing logged. The action returned success and the owner
// heard silence.
//
// That is exactly the failure mode source-text assertions exist for — the same
// reasoning as tests/tester-tour-render-mode.test.ts. Deleting the send block
// breaks no build, throws no error, and passes every behavioural test in the
// tree. Only a reader notices, months later, via a confused owner.
//
// These assertions pin the four properties that make the send safe, not the
// prose of the email. The copy is tested in tests/entity-approved-email.test.ts.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const src = readFileSync(
  path.resolve(process.cwd(), 'lib/actions/admin/approveEntity.ts'),
  'utf8'
)

describe('the send exists at all', () => {
  it('imports the template and the mailer', () => {
    expect(src).toContain("from '@/lib/email/resend'")
    expect(src).toContain("from '@/lib/email/templates/entity-approved'")
  })

  it('calls sendEmail with the approved-listing template', () => {
    expect(src).toContain('sendEmail(')
    expect(src).toContain('EntityApprovedEmail(')
  })
})

describe('the send cannot break the approval', () => {
  it('is fire-and-forget — the action does not await it', () => {
    // rejectEntity.ts:70 uses the same `void (async () => {...})()` shape. An
    // awaited send would put Resend's latency, and its failure modes, on the
    // path of a publish that has already committed.
    expect(src).toMatch(/void \(async \(\) => \{/)
  })

  it('runs after the status update, not before it', () => {
    const update = src.indexOf("status: 'published'")
    const send = src.indexOf('sendEmail(')
    expect(update).toBeGreaterThan(-1)
    expect(send).toBeGreaterThan(update)
  })

  it('skips quietly when the submitter has no account or no address', () => {
    expect(src).toContain('if (listing.submitted_by)')
    expect(src).toMatch(/if \(!submitterEmail\) return/)
  })
})

describe('the listing link', () => {
  it('selects the columns the URL is built from', () => {
    // Widened from `id, name, status, trust_tier`. Drop one of these and the
    // link silently degrades to the dashboard fallback for every approval.
    for (const column of ['slug', 'entity_type', 'submitted_by']) {
      expect(src).toContain(column)
    }
    expect(src).toContain('cities!listings_city_id_fkey(slug)')
  })

  it('builds the URL through the shared helper, not by hand', () => {
    // lib/listings/url.ts carries the three-segment rule and the `online`
    // fallback. A hand-rolled two-segment path resolves to the category route
    // and 404s.
    expect(src).toContain('buildEntityUrl(')
  })

  it('passes null instead of a half-built path when slug or type is missing', () => {
    expect(src).toMatch(/listing\.slug && listing\.entity_type/)
    expect(src).toMatch(/:\s*null/)
  })
})
