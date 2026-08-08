// =============================================================================
// Account-surface defect tail regression tests
// =============================================================================
// Covers the two defects fixed from the founder's 2026-08-06 click-walk:
//
//   F6  /account/activity always rendered "No visits yet". The page reads
//       analytics_events through the user-scoped client, and the only SELECT
//       policy on that table was owner-scoped — so RLS default-deny returned
//       zero rows for every visitor. Guarded here by parsing the real migration
//       SQL, the same way tests/trust-tier.test.ts guards the trust_tier CHECK,
//       so dropping the policy fails CI instead of silently emptying the page.
//
//   F8  Admin surfaces rendered "Unknown" — or a raw UUID — for real people
//       whose profiles.display_name was never set. lib/admin/userLabel.ts is
//       the shared display_name -> auth email ladder those surfaces now use.
// =============================================================================

import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { resolveUserLabels, resolveUserLabel, UNKNOWN_USER_LABEL } from '@/lib/admin/userLabel'

// ── F6: the self-read policy must exist in the migrations ───────────────────

describe('analytics_events RLS self-read policy', () => {
  // Concatenate every migration in filename order. Later files win, so a
  // subsequent DROP POLICY without a matching CREATE will be visible here.
  function migrationSql(): string {
    const dir = path.resolve(process.cwd(), 'supabase/migrations')
    return readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => readFileSync(path.join(dir, f), 'utf8'))
      .join('\n')
  }

  // Strip `--` line comments so the down-plan block at the bottom of the
  // migration (which is commented-out SQL) can't satisfy these assertions.
  function activeSql(): string {
    return migrationSql()
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n')
  }

  it('creates a SELECT policy letting a user read their own events', () => {
    const sql = activeSql()
    const match = sql.match(
      /CREATE POLICY "analytics_events: user reads own listing views"[\s\S]*?;/i
    )
    expect(match, 'self-read policy missing from supabase/migrations').not.toBeNull()

    const policy = match![0]
    expect(policy).toMatch(/FOR SELECT/i)
    expect(policy).toMatch(/TO authenticated/i)
    expect(policy).toMatch(/user_id\s*=\s*auth\.uid\(\)/i)
  })

  it('scopes the policy to the predicate /account/activity actually queries', () => {
    // Not a blanket user_id read: analytics_events carries session IDs, hashed
    // IPs, user agents and arbitrary properties for every instrumented action.
    // Widening this policy is a data-privacy decision, not a refactor.
    const policy = activeSql().match(
      /CREATE POLICY "analytics_events: user reads own listing views"[\s\S]*?;/i
    )![0]
    expect(policy).toMatch(/event_name\s*=\s*'page_view'/i)
    expect(policy).toMatch(/entity_type\s*=\s*'listing'/i)
  })

  it('leaves the owner-analytics policy in place', () => {
    // SELECT policies are OR-ed; the new one must be additive.
    expect(activeSql()).toMatch(/CREATE POLICY "analytics_events: owner read own listing events"/i)
  })

  it('indexes the query the policy unblocks', () => {
    expect(activeSql()).toMatch(/CREATE INDEX[\s\S]*?analytics_events_user_listing_views_idx/i)
  })
})

// ── F8: the shared admin user-label ladder ──────────────────────────────────

/**
 * Minimal fake of the service-role client: one `profiles` table read (thenable
 * builder, matching the pattern in trust-tier.test.ts) plus the auth admin API.
 */
function makeFakeClient(opts: {
  profiles?: { id: string; display_name: string | null }[]
  emails?: Record<string, string>
  getUserByIdThrows?: boolean
}) {
  const getUserById = vi.fn(async (id: string) => {
    if (opts.getUserByIdThrows) throw new Error('auth admin unavailable')
    return { data: { user: opts.emails?.[id] ? { email: opts.emails[id] } : null } }
  })

  const profilesIn = vi.fn()

  function from() {
    const builder: Record<string, unknown> = {
      select: () => builder,
      in: (_col: string, ids: string[]) => {
        profilesIn(ids)
        return builder
      },
      then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
        Promise.resolve(resolve({ data: opts.profiles ?? [], error: null })),
    }
    return builder
  }

  // The helper only touches `from` and `auth.admin.getUserById`; the cast keeps
  // the test from having to satisfy the whole SupabaseClient surface.
  const client = { from, auth: { admin: { getUserById } } }
  return { client: client as never, getUserById, profilesIn }
}

describe('resolveUserLabels', () => {
  it('returns the display name when the profile has one', async () => {
    const { client, getUserById } = makeFakeClient({
      profiles: [{ id: 'u1', display_name: 'Dana Reeves' }],
    })

    await expect(resolveUserLabels(client, ['u1'])).resolves.toEqual({ u1: 'Dana Reeves' })
    // No auth round trip when the profile already answered.
    expect(getUserById).not.toHaveBeenCalled()
  })

  it('falls back to the auth email when display_name is null', async () => {
    const { client, getUserById } = makeFakeClient({
      profiles: [{ id: 'u1', display_name: null }],
      emails: { u1: 'owner@example.test' },
    })

    await expect(resolveUserLabels(client, ['u1'])).resolves.toEqual({ u1: 'owner@example.test' })
    expect(getUserById).toHaveBeenCalledTimes(1)
  })

  it('omits an id that resolves to neither, so the caller can layer its own fallback', async () => {
    const { client } = makeFakeClient({ profiles: [] })
    await expect(resolveUserLabels(client, ['u1'])).resolves.toEqual({})
  })

  it('deduplicates ids and skips null/undefined', async () => {
    const { client, profilesIn } = makeFakeClient({
      profiles: [{ id: 'u1', display_name: 'Dana Reeves' }],
    })

    await resolveUserLabels(client, ['u1', 'u1', null, undefined])
    expect(profilesIn).toHaveBeenCalledWith(['u1'])
  })

  it('short-circuits with no query at all when given no ids', async () => {
    const { client, profilesIn, getUserById } = makeFakeClient({})
    await expect(resolveUserLabels(client, [null, undefined])).resolves.toEqual({})
    expect(profilesIn).not.toHaveBeenCalled()
    expect(getUserById).not.toHaveBeenCalled()
  })

  it('only looks up the ids the profiles query left unresolved', async () => {
    const { client, getUserById } = makeFakeClient({
      profiles: [
        { id: 'u1', display_name: 'Dana Reeves' },
        { id: 'u2', display_name: null },
      ],
      emails: { u2: 'second@example.test' },
    })

    await expect(resolveUserLabels(client, ['u1', 'u2'])).resolves.toEqual({
      u1: 'Dana Reeves',
      u2: 'second@example.test',
    })
    expect(getUserById).toHaveBeenCalledTimes(1)
    expect(getUserById).toHaveBeenCalledWith('u2')
  })

  it('never lets a failing auth lookup take down the page', async () => {
    const { client } = makeFakeClient({
      profiles: [{ id: 'u1', display_name: null }],
      getUserByIdThrows: true,
    })

    await expect(resolveUserLabels(client, ['u1'])).resolves.toEqual({})
  })
})

describe('resolveUserLabel', () => {
  it('returns null for a null user id without querying', async () => {
    const { client, profilesIn } = makeFakeClient({})
    await expect(resolveUserLabel(client, null)).resolves.toBeNull()
    expect(profilesIn).not.toHaveBeenCalled()
  })

  it('returns null — not a UUID — when nothing resolves', async () => {
    // The defect was admin pages rendering the raw user id as a person's name.
    // The helper hands back null so the caller renders UNKNOWN_USER_LABEL.
    const { client } = makeFakeClient({ profiles: [] })
    await expect(resolveUserLabel(client, 'u1')).resolves.toBeNull()
    expect(UNKNOWN_USER_LABEL).toBe('Unknown user')
  })
})
