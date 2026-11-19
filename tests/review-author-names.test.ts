// =============================================================================
// Review author names (founder, 2026-11-19: "First name + initial")
// =============================================================================
// Every review on every live listing showed "A Customer": profiles is own-read
// only, and the listing page read it as the visitor. The fix is a SECURITY
// DEFINER function that returns only "Jasmine R." for authors of published
// reviews. vitest has no database, so this guards the migration and the page by
// reading the source, as tests/account-surfaces.test.ts does for its policy.
// The SQL itself was run against a local Postgres 14 (see the PR).
// =============================================================================

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (p: string) => readFileSync(path.resolve(process.cwd(), p), 'utf8')
const sql = read('supabase/migrations/20261129000000_review_author_names.sql')
const fn = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION review_author_names'))

describe('review_author_names migration', () => {
  it('returns the short name only, never the full display_name', () => {
    expect(fn).toMatch(/RETURNS TABLE \(reviewer_user_id uuid, short_name text\)/)
    expect(fn).toMatch(
      /SELECT DISTINCT r\.reviewer_user_id, short_display_name\(p\.display_name\)\n/
    )
  })

  it('covers published reviews on one listing only', () => {
    expect(fn).toMatch(/WHERE r\.listing_id = p_listing_id/)
    expect(fn).toMatch(/AND r\.status = 'published'/)
  })

  it('runs as definer with a pinned search_path, callable by visitors', () => {
    expect(fn).toMatch(/SECURITY DEFINER\nSET search_path = public/)
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION review_author_names\(uuid\) FROM PUBLIC;/)
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION review_author_names\(uuid\) TO anon, authenticated;/
    )
  })

  it('shortens to first word + last initial and drops anything with an @', () => {
    expect(sql).toMatch(/WHEN position\('@' IN p_name\) > 0 THEN NULL/)
    expect(sql).toMatch(
      /ELSE w\[1\] \|\| ' ' \|\| upper\(left\(w\[cardinality\(w\)\], 1\)\) \|\| '\.'/
    )
  })

  it('leaves the profiles policies alone', () => {
    expect(sql).not.toMatch(/(CREATE|DROP|ALTER) POLICY/i)
    expect(sql).not.toMatch(/ALTER TABLE/i)
  })
})

describe('listing page', () => {
  const page = read('lib/listings/entityPage.ts')

  it('reads author names through the function, not the profiles table', () => {
    expect(page).toMatch(/rpc\('review_author_names', \{\s*p_listing_id: raw\.id,?\s*\}\)/)
    expect(page).not.toMatch(/\.from\('profiles'\)/)
  })
})

describe('what people are told', () => {
  it('the privacy policy says reviews show first name and last initial', () => {
    const policy = read('app/(public)/privacy/PrivacyPolicy.tsx')
    expect(policy).toMatch(/<strong>Reviews you post:<\/strong>/)
    expect(policy.replace(/\s+/g, ' ')).toMatch(
      /under your first name and last initial from your Display Name/
    )
  })

  it('the Display Name field says so too, and is described by it', () => {
    const form = read('app/account/settings/AccountSettingsForm.tsx')
    expect(form).toMatch(/id="display_name-hint"/)
    expect(form).toMatch(/'display_name-hint',/)
    expect(form).toMatch(/Your reviews show your first name and last initial/)
  })
})
