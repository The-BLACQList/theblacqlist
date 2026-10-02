// =============================================================================
// Claims and reviews are inserted by the service role only (2026-10-02)
// =============================================================================
// 20261002000000_drop_direct_claim_review_inserts.sql drops the RLS INSERT
// policies on `claims` and `reviews`. Before that, any signed-in user could
// POST straight to PostgREST and skip Turnstile, the quotas, the duplicate
// checks and "owners cannot review their own business".
//
// So the two server actions now insert through the service client, which
// bypasses RLS. That moves two jobs into app code, and these source contracts
// pin both:
//
//   * The service client is created only after the user is known and the
//     Turnstile check (and the action's other gates) have passed. Created any
//     earlier, a refactor could slip an RLS-free write ahead of the checks.
//   * The insert still sets the invariants the dropped policies enforced: the
//     owner field is the signed-in user's id, the status is the birth status,
//     and a claim never arrives already reviewed.
//
// The database half is tests/migrations/drop-direct-claim-review-inserts.test.ts.
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')

interface Case {
  file: string
  table: 'claims' | 'reviews'
  ownerField: string
  status: string
  // Source markers for the action's own gates. The service client must come
  // after every one of them.
  gates: string[]
}

const CASES: Case[] = [
  {
    file: 'lib/actions/claims/createClaim.ts',
    table: 'claims',
    ownerField: 'claimant_user_id',
    status: 'pending',
    gates: [
      'auth.getUser()',
      'verifyTurnstileFormData(formData)',
      'if (existingClaim)',
      'recentCount ?? 0',
    ],
  },
  {
    file: 'lib/actions/reviews/createReview.ts',
    table: 'reviews',
    ownerField: 'reviewer_user_id',
    status: 'intake',
    gates: [
      'auth.getUser()',
      "bucket: 'review'",
      'verifyTurnstileFormData(formData)',
      'listing.owner_user_id === user.id',
      'if (existing)',
    ],
  },
]

describe.each(CASES)('$file inserts into $table with the service role only', (c) => {
  const src = read(c.file)

  // `await <client>\n    .from('<table>')\n    .insert({ ... })`
  const insertRe = new RegExp(
    String.raw`await\s+(\w+)\s*\.from\('${c.table}'\)\s*\.insert\(\{([\s\S]*?)\}\)`,
    'g'
  )
  const inserts = [...src.matchAll(insertRe)]
  const serviceDecl = src.match(/const (\w+) = createServiceClient\(\)/)

  it('creates exactly one service client and inserts the row through it', () => {
    expect(src.match(/createServiceClient\(\)/g)).toHaveLength(1)
    expect(serviceDecl).not.toBeNull()
    expect(inserts).toHaveLength(1)
    expect(inserts[0]![1]).toBe(serviceDecl![1])
    // The user client is still `supabase`; it must never write this table.
    expect(src).not.toMatch(
      new RegExp(String.raw`supabase\s*\.from\('${c.table}'\)\s*\.(insert|upsert)\(`)
    )
  })

  it('creates the service client only after auth, Turnstile and the action gates', () => {
    const serviceAt = src.indexOf('createServiceClient()')
    for (const gate of c.gates) {
      const gateAt = src.indexOf(gate)
      expect(gateAt, gate).toBeGreaterThan(-1)
      expect(serviceAt, `service client after ${gate}`).toBeGreaterThan(gateAt)
    }
    expect(inserts[0]!.index).toBeGreaterThan(serviceAt)
  })

  it('keeps the invariants the dropped RLS policy enforced', () => {
    const body = inserts[0]![2]
    expect(body).toMatch(new RegExp(String.raw`\b${c.ownerField}: user\.id,`))
    expect(body).toMatch(new RegExp(String.raw`\bstatus: '${c.status}',`))
    for (const field of ['reviewed_at', 'reviewed_by', 'rejection_reason']) {
      expect(body).not.toMatch(new RegExp(String.raw`\b${field}\b`))
    }
  })
})
