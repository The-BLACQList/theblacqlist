import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'
import { generateTesterToken, hashTesterToken } from '@/lib/tester/links'
import {
  REDEEM_EXPIRED,
  REDEEM_FAILED,
  REDEEM_MISSING,
  REDEEM_RATE_LIMITED,
  redeemTesterInvite,
  type RedeemDeps,
} from '@/lib/tester/redeem'

// Every branch of the one-tap redeem (one-tap-link-plan-2026-10-01.md), run
// against an in-memory service client. The double records the order of the
// calls that matter, so "enroll before sign-in" is checked, not assumed.

type Invite = {
  id: string
  kind: 'owner' | 'supporter'
  email: string | null
  listing_id: string | null
  tester_user_id: string | null
  created_by: string | null
}

type Err = { code: string } | null

function makeWorld() {
  const w = {
    claim: null as Invite | null,
    claimError: null as Err,
    claimedHash: null as string | null,
    users: new Map<string, string>(), // id -> email
    /** Emails find_auth_user_id_by_email should NOT see until after createUser fails. */
    hiddenUntilRace: new Set<string>(),
    createError: null as Err,
    listing: null as null | { id: string; status: string; owner_user_id: string | null; deleted_at: string | null },
    liveEnrollment: null as null | { id: string },
    insertError: null as Err,
    bindError: null as Err,
    generateLinkError: null as Err,
    bound: null as null | { payload: Record<string, unknown>; filters: string[] },
    inserted: [] as Record<string, unknown>[],
    created: [] as Record<string, unknown>[],
    log: [] as string[],
    nextUserId: 1,
  }

  function idForEmail(email: string): string | null {
    for (const [id, e] of w.users) if (e === email) return id
    return null
  }

  function from(table: string) {
    const q = { op: 'select' as 'select' | 'update', payload: null as Record<string, unknown> | null, filters: [] as string[] }
    const run = () => {
      if (table === 'tester_invites' && q.op === 'update') {
        w.log.push('bind')
        w.bound = { payload: q.payload!, filters: q.filters }
        return { data: null, error: w.bindError }
      }
      throw new Error(`unexpected ${q.op} on ${table}`)
    }
    const b = {
      select: () => b,
      update: (payload: Record<string, unknown>) => {
        q.op = 'update'
        q.payload = payload
        return b
      },
      eq: (col: string, val: unknown) => {
        q.filters.push(`eq:${col}=${String(val)}`)
        return b
      },
      is: (col: string, val: unknown) => {
        q.filters.push(`is:${col}=${String(val)}`)
        return b
      },
      maybeSingle: async () => {
        if (table === 'listings') return { data: w.listing, error: null }
        if (table === 'tour_enrollments') {
          w.log.push('enroll:lookup')
          return { data: w.liveEnrollment, error: null }
        }
        throw new Error(`unexpected maybeSingle on ${table}`)
      },
      insert: async (row: Record<string, unknown>) => {
        if (table !== 'tour_enrollments') throw new Error(`unexpected insert on ${table}`)
        w.log.push('enroll:insert')
        w.inserted.push(row)
        return { data: null, error: w.insertError }
      },
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve().then(run).then(resolve, reject),
    }
    return b
  }

  const service = {
    rpc: async (name: string, args: { p_token_hash: string; p_email: string }) => {
      if (name === 'redeem_tester_invite') {
        w.log.push('claim')
        w.claimedHash = args.p_token_hash
        if (w.claimError) return { data: null, error: w.claimError }
        return { data: w.claim ? [w.claim] : [], error: null }
      }
      if (name === 'find_auth_user_id_by_email') {
        if (w.hiddenUntilRace.has(args.p_email)) return { data: null, error: null }
        return { data: idForEmail(args.p_email), error: null }
      }
      throw new Error(`unexpected rpc ${name}`)
    },
    from,
    auth: {
      admin: {
        getUserById: async (id: string) => {
          const email = w.users.get(id)
          return email ? { data: { user: { id, email } }, error: null } : { data: { user: null }, error: { code: 'user_not_found' } }
        },
        createUser: async (attrs: Record<string, unknown>) => {
          w.log.push('createUser')
          w.created.push(attrs)
          if (w.createError) {
            // The racing request won: the user exists now, under the other id.
            w.hiddenUntilRace.clear()
            return { data: { user: null }, error: w.createError }
          }
          const id = `new-${w.nextUserId++}`
          w.users.set(id, attrs.email as string)
          return { data: { user: { id } }, error: null }
        },
        generateLink: async (params: { type: string; email: string }) => {
          w.log.push(`generateLink:${params.email}`)
          if (w.generateLinkError) return { data: null, error: w.generateLinkError }
          return { data: { properties: { hashed_token: 'otp-hash' } }, error: null }
        },
      },
    },
  }

  return { w, service: service as unknown as SupabaseClient<Database> }
}

let world: ReturnType<typeof makeWorld>
let deps: RedeemDeps & {
  allowAttempt: ReturnType<typeof vi.fn>
  isAdmin: ReturnType<typeof vi.fn>
  signIn: ReturnType<typeof vi.fn>
}
const token = generateTesterToken()

function supporterInvite(over: Partial<Invite> = {}): Invite {
  return { id: 'inv-1', kind: 'supporter', email: 'tester@example.com', listing_id: null, tester_user_id: null, created_by: 'admin-1', ...over }
}

function ownerInvite(over: Partial<Invite> = {}): Invite {
  return { id: 'inv-2', kind: 'owner', email: null, listing_id: 'lst-1', tester_user_id: null, created_by: 'admin-1', ...over }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  world = makeWorld()
  deps = {
    service: world.service,
    allowAttempt: vi.fn(async () => true),
    isAdmin: vi.fn(async () => false),
    signIn: vi.fn(async () => {
      world.w.log.push('signIn')
      return { error: null }
    }),
  }
})

describe('redeemTesterInvite: before the claim', () => {
  it('reads an empty token as missing and spends nothing', async () => {
    expect(await redeemTesterInvite('', deps)).toEqual({ ok: false, error: REDEEM_MISSING })
    expect(deps.allowAttempt).not.toHaveBeenCalled()
    expect(world.w.log).toEqual([])
  })

  it('reads a malformed token as expired, without a database call', async () => {
    expect(await redeemTesterInvite('not-a-token', deps)).toEqual({ ok: false, error: REDEEM_EXPIRED })
    expect(world.w.log).toEqual([])
  })

  it('stops at the rate limit before claiming', async () => {
    deps.allowAttempt.mockResolvedValueOnce(false)
    expect(await redeemTesterInvite(token, deps)).toEqual({ ok: false, error: REDEEM_RATE_LIMITED })
    expect(world.w.log).toEqual([])
  })
})

describe('redeemTesterInvite: the claim', () => {
  it('sends only the hash, never the token', async () => {
    await redeemTesterInvite(token, deps)
    expect(world.w.claimedHash).toBe(hashTesterToken(token))
  })

  it('reads zero rows as expired', async () => {
    expect(await redeemTesterInvite(token, deps)).toEqual({ ok: false, error: REDEEM_EXPIRED })
  })

  it('reads a claim error as failed', async () => {
    world.w.claimError = { code: '57014' }
    expect(await redeemTesterInvite(token, deps)).toEqual({ ok: false, error: REDEEM_FAILED })
  })
})

describe('redeemTesterInvite: supporter links', () => {
  it('creates a confirmed account on first use, binds it, enrolls without a listing, then signs in', async () => {
    world.w.claim = supporterInvite()
    const result = await redeemTesterInvite(token, deps)

    expect(result).toEqual({ ok: true, inviteId: 'inv-1', testerUserId: 'new-1', createdBy: 'admin-1' })
    expect(world.w.created).toEqual([
      { email: 'tester@example.com', email_confirm: true, user_metadata: { signup_source: 'tester_link' } },
    ])
    expect(world.w.bound).toEqual({
      payload: { tester_user_id: 'new-1' },
      filters: ['eq:id=inv-1', 'is:tester_user_id=null'],
    })
    expect(world.w.inserted).toEqual([{ tester_user_id: 'new-1', listing_id: null, invited_by: 'admin-1' }])
    expect(deps.signIn).toHaveBeenCalledWith('otp-hash')
    expect(world.w.log).toEqual([
      'claim',
      'createUser',
      'bind',
      'enroll:lookup',
      'enroll:insert',
      'generateLink:tester@example.com',
      'signIn',
    ])
  })

  it('finds an existing account by email instead of creating one', async () => {
    world.w.users.set('u-existing', 'tester@example.com')
    world.w.claim = supporterInvite()
    const result = await redeemTesterInvite(token, deps)
    expect(result).toMatchObject({ ok: true, testerUserId: 'u-existing' })
    expect(world.w.created).toEqual([])
  })

  it('reuses the bound account on later uses and skips the bind', async () => {
    world.w.users.set('u-bound', 'bound@example.com')
    world.w.claim = supporterInvite({ tester_user_id: 'u-bound' })
    const result = await redeemTesterInvite(token, deps)
    expect(result).toMatchObject({ ok: true, testerUserId: 'u-bound' })
    expect(world.w.bound).toBeNull()
    expect(world.w.log).toContain('generateLink:bound@example.com')
  })

  it('resolves a createUser race by finding the winner', async () => {
    world.w.users.set('u-winner', 'tester@example.com')
    world.w.hiddenUntilRace.add('tester@example.com')
    world.w.createError = { code: 'email_exists' }
    world.w.claim = supporterInvite()
    expect(await redeemTesterInvite(token, deps)).toMatchObject({ ok: true, testerUserId: 'u-winner' })
  })

  it('fails when createUser fails and no account turns up', async () => {
    world.w.createError = { code: 'unexpected_failure' }
    world.w.claim = supporterInvite()
    expect(await redeemTesterInvite(token, deps)).toEqual({ ok: false, error: REDEEM_FAILED })
    expect(deps.signIn).not.toHaveBeenCalled()
  })

  it('refuses a supporter link with no email as expired', async () => {
    world.w.claim = supporterInvite({ email: null })
    expect(await redeemTesterInvite(token, deps)).toEqual({ ok: false, error: REDEEM_EXPIRED })
  })
})

describe('redeemTesterInvite: owner links', () => {
  beforeEach(() => {
    world.w.users.set('u-owner', 'owner@example.com')
    world.w.listing = { id: 'lst-1', status: 'published', owner_user_id: 'u-owner', deleted_at: null }
  })

  it('signs in as the current owner and enrolls with the listing', async () => {
    world.w.claim = ownerInvite()
    expect(await redeemTesterInvite(token, deps)).toMatchObject({ ok: true, testerUserId: 'u-owner' })
    expect(world.w.inserted).toEqual([{ tester_user_id: 'u-owner', listing_id: 'lst-1', invited_by: 'admin-1' }])
    expect(world.w.log).toContain('generateLink:owner@example.com')
  })

  it.each([
    ['unpublished', { status: 'draft' }],
    ['deleted', { deleted_at: '2026-10-02T00:00:00Z' }],
    ['ownerless', { owner_user_id: null }],
  ])('refuses a %s listing as expired', async (_name, change) => {
    world.w.listing = { ...world.w.listing!, ...change }
    world.w.claim = ownerInvite()
    expect(await redeemTesterInvite(token, deps)).toEqual({ ok: false, error: REDEEM_EXPIRED })
    expect(deps.signIn).not.toHaveBeenCalled()
  })

  it('refuses a missing listing as expired', async () => {
    world.w.listing = null
    world.w.claim = ownerInvite()
    expect(await redeemTesterInvite(token, deps)).toEqual({ ok: false, error: REDEEM_EXPIRED })
  })

  it('never follows a listing to a new owner once bound', async () => {
    world.w.claim = ownerInvite({ tester_user_id: 'u-previous-owner' })
    expect(await redeemTesterInvite(token, deps)).toEqual({ ok: false, error: REDEEM_EXPIRED })
    expect(world.w.log).not.toContain('generateLink:owner@example.com')
  })
})

describe('redeemTesterInvite: guards and enrollment', () => {
  it('refuses an admin account with the generic message and no session', async () => {
    world.w.users.set('u-admin', 'tester@example.com')
    world.w.claim = supporterInvite()
    deps.isAdmin.mockResolvedValueOnce(true)
    expect(await redeemTesterInvite(token, deps)).toEqual({ ok: false, error: REDEEM_EXPIRED })
    expect(world.w.bound).toBeNull()
    expect(world.w.inserted).toEqual([])
    expect(deps.signIn).not.toHaveBeenCalled()
  })

  it('keeps an existing live enrollment and inserts nothing', async () => {
    world.w.claim = supporterInvite()
    world.w.liveEnrollment = { id: 'enr-live' }
    expect(await redeemTesterInvite(token, deps)).toMatchObject({ ok: true })
    expect(world.w.inserted).toEqual([])
  })

  it('tolerates a unique violation from a racing enrollment', async () => {
    world.w.claim = supporterInvite()
    world.w.insertError = { code: '23505' }
    expect(await redeemTesterInvite(token, deps)).toMatchObject({ ok: true })
  })

  it('fails on any other enrollment error, before sign-in', async () => {
    world.w.claim = supporterInvite()
    world.w.insertError = { code: '23514' }
    expect(await redeemTesterInvite(token, deps)).toEqual({ ok: false, error: REDEEM_FAILED })
    expect(deps.signIn).not.toHaveBeenCalled()
  })

  it('fails when the bind errors', async () => {
    world.w.claim = supporterInvite()
    world.w.bindError = { code: '40001' }
    expect(await redeemTesterInvite(token, deps)).toEqual({ ok: false, error: REDEEM_FAILED })
  })

  it('fails when generateLink errors', async () => {
    world.w.claim = supporterInvite()
    world.w.generateLinkError = { code: 'unexpected_failure' }
    expect(await redeemTesterInvite(token, deps)).toEqual({ ok: false, error: REDEEM_FAILED })
    expect(deps.signIn).not.toHaveBeenCalled()
  })

  it('fails when sign-in errors, with the enrollment already in place for a retry', async () => {
    world.w.claim = supporterInvite()
    deps.signIn.mockResolvedValueOnce({ error: { code: 'otp_expired' } })
    expect(await redeemTesterInvite(token, deps)).toEqual({ ok: false, error: REDEEM_FAILED })
    expect(world.w.inserted).toHaveLength(1)
  })

  it('never logs the token, its hash or an email', async () => {
    const spy = vi.mocked(console.error)
    world.w.claim = supporterInvite()
    world.w.insertError = { code: '23514' }
    await redeemTesterInvite(token, deps)
    deps.isAdmin.mockResolvedValueOnce(true)
    await redeemTesterInvite(token, deps)
    const logged = JSON.stringify(spy.mock.calls)
    expect(spy).toHaveBeenCalled()
    expect(logged).not.toContain(token)
    expect(logged).not.toContain(hashTesterToken(token))
    expect(logged).not.toContain('@')
  })
})
