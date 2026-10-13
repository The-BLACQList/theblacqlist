import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'
import { generateTesterToken, hashTesterToken } from '@/lib/tester/links'
import {
  REDEEM_BAD_EMAIL,
  REDEEM_EMAIL_TAKEN,
  REDEEM_EXPIRED,
  REDEEM_FAILED,
  REDEEM_FULL,
  REDEEM_MISSING,
  REDEEM_NEED_EMAIL,
  REDEEM_NEED_ROLE,
  REDEEM_RATE_LIMITED,
  redeemTesterInvite,
  testerLinkStart,
  type RedeemDeps,
} from '@/lib/tester/redeem'

// Every branch of the one-tap redeem (one-tap-link-plan-2026-10-01.md), run
// against an in-memory service client. The double records the order of the
// calls that matter, so "enroll before sign-in" is checked, not assumed.

type Invite = {
  id: string
  kind: 'owner' | 'supporter' | 'shared'
  email: string | null
  listing_id: string | null
  tester_user_id: string | null
  created_by: string | null
}

type Err = { code: string; message?: string } | null

/** What the read-only peek sees before the claim. */
type PeekRow = {
  id?: string
  created_by?: string | null
  kind: 'owner' | 'supporter' | 'shared'
  email: string | null
  listing_id: string | null
  tester_user_id: string | null
  revoked_at: string | null
  expires_at: string
  use_count: number
  max_uses: number
}

function makeWorld() {
  const w = {
    peek: null as PeekRow | null,
    peekError: null as Err,
    claim: null as Invite | null,
    claimError: null as Err,
    claimedHash: null as string | null,
    users: new Map<string, string>(), // id -> email
    /** Emails find_auth_user_id_by_email should NOT see until after createUser fails. */
    hiddenUntilRace: new Set<string>(),
    createError: null as Err,
    listing: null as null | { id: string; status: string; owner_user_id: string | null; deleted_at: string | null },
    liveEnrollment: null as null | { id: string; listing_id: string | null; is_owner: boolean },
    /** Live enrollments across every tester, for the shared link's full check. */
    liveCount: 0,
    countError: null as Err,
    upgraded: null as null | { payload: Record<string, unknown>; filters: string[] },
    upgradeError: null as Err,
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
    const q = {
      op: 'select' as 'select' | 'update',
      head: false,
      payload: null as Record<string, unknown> | null,
      filters: [] as string[],
    }
    const run = () => {
      if (table === 'tour_enrollments' && q.op === 'select' && q.head) {
        w.log.push('count')
        return { count: w.countError ? null : w.liveCount, error: w.countError }
      }
      if (table === 'tester_invites' && q.op === 'update') {
        w.log.push('bind')
        w.bound = { payload: q.payload!, filters: q.filters }
        return { data: null, error: w.bindError }
      }
      if (table === 'tour_enrollments' && q.op === 'update') {
        w.log.push('enroll:upgrade')
        w.upgraded = { payload: q.payload!, filters: q.filters }
        return { data: null, error: w.upgradeError }
      }
      throw new Error(`unexpected ${q.op} on ${table}`)
    }
    const b = {
      select: (_cols?: string, opts?: { head?: boolean }) => {
        q.head = opts?.head === true
        return b
      },
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
        if (table === 'tester_invites') {
          w.log.push('peek')
          return { data: w.peekError ? null : w.peek, error: w.peekError }
        }
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
  sessionUserId: ReturnType<typeof vi.fn>
}
const token = generateTesterToken()

function supporterInvite(over: Partial<Invite> = {}): Invite {
  return { id: 'inv-1', kind: 'supporter', email: 'tester@example.com', listing_id: null, tester_user_id: null, created_by: 'admin-1', ...over }
}

/** A live supporter link made without an email, not used yet. */
function emailLessPeek(over: Partial<PeekRow> = {}): PeekRow {
  return {
    kind: 'supporter',
    email: null,
    listing_id: null,
    tester_user_id: null,
    revoked_at: null,
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    use_count: 0,
    max_uses: 5,
    ...over,
  }
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
    sessionUserId: vi.fn(async () => null),
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

    expect(result).toEqual({
      ok: true,
      inviteId: 'inv-1',
      testerUserId: 'new-1',
      createdBy: 'admin-1',
      firstStop: '/search',
    })
    expect(world.w.created).toEqual([
      { email: 'tester@example.com', email_confirm: true, user_metadata: { signup_source: 'tester_link' } },
    ])
    expect(world.w.bound).toEqual({
      payload: { tester_user_id: 'new-1' },
      filters: ['eq:id=inv-1', 'is:tester_user_id=null'],
    })
    expect(world.w.inserted).toEqual([
      { tester_user_id: 'new-1', listing_id: null, is_owner: false, invited_by: 'admin-1' },
    ])
    expect(deps.signIn).toHaveBeenCalledWith('otp-hash')
    expect(world.w.log).toEqual([
      'peek',
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

  it('refuses an unbound supporter link with no email when the peek did not pick an account', async () => {
    // The peek saw a dead link, then the claim still returned a row: no account
    // was chosen, so nothing is created.
    world.w.claim = supporterInvite({ email: null })
    expect(await redeemTesterInvite(token, deps)).toEqual({ ok: false, error: REDEEM_EXPIRED })
    expect(world.w.created).toEqual([])
  })
})

describe('redeemTesterInvite: supporter links without an email', () => {
  beforeEach(() => {
    world.w.peek = emailLessPeek()
    world.w.claim = supporterInvite({ email: null })
  })

  it('asks for an email and spends no use', async () => {
    expect(await redeemTesterInvite(token, deps)).toEqual({ ok: false, error: REDEEM_NEED_EMAIL, needEmail: true })
    expect(await redeemTesterInvite(token, deps, '   ')).toMatchObject({ error: REDEEM_NEED_EMAIL })
    expect(world.w.log).not.toContain('claim')
  })

  it('refuses a bad email and spends no use', async () => {
    expect(await redeemTesterInvite(token, deps, 'not an email')).toEqual({
      ok: false,
      error: REDEEM_BAD_EMAIL,
      needEmail: true,
    })
    expect(world.w.log).not.toContain('claim')
  })

  it('never signs in to an email that already has an account, and spends no use', async () => {
    world.w.users.set('u-someone', 'someone@example.com')
    expect(await redeemTesterInvite(token, deps, ' Someone@Example.com ')).toEqual({
      ok: false,
      error: REDEEM_EMAIL_TAKEN,
      needEmail: true,
    })
    expect(world.w.log).not.toContain('claim')
    expect(world.w.log.some((l) => l.startsWith('generateLink'))).toBe(false)
    expect(deps.signIn).not.toHaveBeenCalled()
  })

  it('makes a new confirmed account for a new email, binds it and signs in', async () => {
    const result = await redeemTesterInvite(token, deps, 'New.Tester@Example.com')
    expect(result).toEqual({
      ok: true,
      inviteId: 'inv-1',
      testerUserId: 'new-1',
      createdBy: 'admin-1',
      firstStop: '/search',
    })
    expect(world.w.created).toEqual([
      { email: 'new.tester@example.com', email_confirm: true, user_metadata: { signup_source: 'tester_link' } },
    ])
    expect(world.w.bound?.payload).toEqual({ tester_user_id: 'new-1' })
    expect(world.w.log).toEqual([
      'peek',
      'claim',
      'createUser',
      'bind',
      'enroll:lookup',
      'enroll:insert',
      'generateLink:new.tester@example.com',
      'signIn',
    ])
  })

  it('refuses when another request makes the account first, and never falls back to it', async () => {
    world.w.users.set('u-racer', 'new.tester@example.com')
    world.w.hiddenUntilRace.add('new.tester@example.com')
    world.w.createError = { code: 'email_exists' }
    expect(await redeemTesterInvite(token, deps, 'new.tester@example.com')).toEqual({
      ok: false,
      error: REDEEM_EMAIL_TAKEN,
      needEmail: true,
    })
    expect(world.w.bound).toBeNull()
    expect(deps.signIn).not.toHaveBeenCalled()
  })

  it('fails when createUser fails for another reason', async () => {
    world.w.createError = { code: 'unexpected_failure' }
    expect(await redeemTesterInvite(token, deps, 'new.tester@example.com')).toEqual({ ok: false, error: REDEEM_FAILED })
    expect(deps.signIn).not.toHaveBeenCalled()
  })

  it('puts the tour on a signed-in tester without asking for an email', async () => {
    world.w.users.set('u-session', 'me@example.com')
    deps.sessionUserId.mockResolvedValue('u-session')
    const result = await redeemTesterInvite(token, deps)
    expect(result).toMatchObject({ ok: true, testerUserId: 'u-session' })
    expect(world.w.created).toEqual([])
    expect(world.w.bound?.payload).toEqual({ tester_user_id: 'u-session' })
    expect(world.w.log).toContain('generateLink:me@example.com')
  })

  it('ignores an admin session and asks for an email instead', async () => {
    deps.sessionUserId.mockResolvedValue('u-admin')
    deps.isAdmin.mockImplementation(async (id: string) => id === 'u-admin')
    expect(await redeemTesterInvite(token, deps)).toMatchObject({ error: REDEEM_NEED_EMAIL, needEmail: true })
    expect(world.w.log).not.toContain('claim')
  })

  it('fails when the peek errors, and spends no use', async () => {
    world.w.peekError = { code: '57014' }
    expect(await redeemTesterInvite(token, deps, 'new.tester@example.com')).toEqual({ ok: false, error: REDEEM_FAILED })
    expect(world.w.log).not.toContain('claim')
  })

  it('goes straight to the bound account once the first use made one', async () => {
    world.w.users.set('u-bound', 'bound@example.com')
    world.w.peek = emailLessPeek({ tester_user_id: 'u-bound', use_count: 1 })
    world.w.claim = supporterInvite({ email: null, tester_user_id: 'u-bound' })
    expect(await redeemTesterInvite(token, deps)).toMatchObject({ ok: true, testerUserId: 'u-bound' })
    expect(world.w.created).toEqual([])
  })
})

describe('testerLinkStart', () => {
  it('asks for an email on a live, unbound supporter link with no email', async () => {
    world.w.peek = emailLessPeek()
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'email', askRole: false })
  })

  it('reads session when a non-admin is signed in, email when an admin is', async () => {
    world.w.peek = emailLessPeek()
    deps.sessionUserId.mockResolvedValue('u-session')
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'session', askRole: false })
    deps.isAdmin.mockResolvedValue(true)
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'email', askRole: false })
  })

  it.each([
    ['a link with an email', { email: 'tester@example.com' }],
    ['a bound link', { tester_user_id: 'u-bound' }],
    ['a revoked link', { revoked_at: '2026-10-10T00:00:00Z' }],
    ['an expired link', { expires_at: '2026-01-01T00:00:00Z' }],
    ['a used-up link', { use_count: 5 }],
    ['an owner link with a page', { kind: 'owner' as const, listing_id: 'lst-1' }],
  ])('reads %s as ready, so the page never hints why a link is dead', async (_name, change) => {
    world.w.peek = emailLessPeek(change)
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'ready', askRole: false })
  })

  it('reads an unknown link, a malformed token or an error as ready', async () => {
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'ready', askRole: false })
    expect(await testerLinkStart('not-a-token', deps)).toEqual({ mode: 'ready', askRole: false })
    world.w.peek = emailLessPeek()
    world.w.peekError = { code: '57014' }
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'ready', askRole: false })
  })

  it('never writes anything', async () => {
    world.w.peek = emailLessPeek()
    await testerLinkStart(token, deps)
    expect(world.w.log).toEqual(['peek'])
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
    expect(world.w.inserted).toEqual([
      { tester_user_id: 'u-owner', listing_id: 'lst-1', is_owner: true, invited_by: 'admin-1' },
    ])
    expect(world.w.log).toContain('generateLink:owner@example.com')
  })

  it('sends an owner with a page to /search after Start', async () => {
    world.w.claim = ownerInvite()
    expect(await redeemTesterInvite(token, deps)).toMatchObject({ ok: true, firstStop: '/search' })
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

describe('redeemTesterInvite: owner links without a page', () => {
  beforeEach(() => {
    world.w.peek = emailLessPeek({ kind: 'owner' })
    world.w.claim = ownerInvite({ listing_id: null })
  })

  it('asks for an email and spends no use', async () => {
    expect(await redeemTesterInvite(token, deps)).toEqual({ ok: false, error: REDEEM_NEED_EMAIL, needEmail: true })
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'email', askRole: false })
    expect(world.w.log).not.toContain('claim')
  })

  it('makes a new account, enrolls it as an owner with no listing and starts on /dashboard', async () => {
    const result = await redeemTesterInvite(token, deps, 'New.Owner@Example.com')
    expect(result).toEqual({
      ok: true,
      inviteId: 'inv-2',
      testerUserId: 'new-1',
      createdBy: 'admin-1',
      firstStop: '/dashboard',
    })
    expect(world.w.created).toEqual([
      { email: 'new.owner@example.com', email_confirm: true, user_metadata: { signup_source: 'tester_link' } },
    ])
    expect(world.w.inserted).toEqual([
      { tester_user_id: 'new-1', listing_id: null, is_owner: true, invited_by: 'admin-1' },
    ])
    // No listing to look up, so nothing reads listings.
    expect(world.w.log).toEqual([
      'peek',
      'claim',
      'createUser',
      'bind',
      'enroll:lookup',
      'enroll:insert',
      'generateLink:new.owner@example.com',
      'signIn',
    ])
  })

  it('never signs in to an email that already has an account, and spends no use', async () => {
    world.w.users.set('u-someone', 'someone@example.com')
    expect(await redeemTesterInvite(token, deps, 'someone@example.com')).toEqual({
      ok: false,
      error: REDEEM_EMAIL_TAKEN,
      needEmail: true,
    })
    expect(world.w.log).not.toContain('claim')
    expect(deps.signIn).not.toHaveBeenCalled()
  })

  it('puts the tour on a signed-in non-admin without asking for an email', async () => {
    world.w.users.set('u-session', 'me@example.com')
    deps.sessionUserId.mockResolvedValue('u-session')
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'session', askRole: false })
    const result = await redeemTesterInvite(token, deps)
    expect(result).toMatchObject({ ok: true, testerUserId: 'u-session', firstStop: '/dashboard' })
    expect(world.w.created).toEqual([])
    expect(world.w.inserted).toEqual([
      { tester_user_id: 'u-session', listing_id: null, is_owner: true, invited_by: 'admin-1' },
    ])
  })

  it('ignores an admin session and asks for an email instead', async () => {
    deps.sessionUserId.mockResolvedValue('u-admin')
    deps.isAdmin.mockImplementation(async (id: string) => id === 'u-admin')
    expect(await redeemTesterInvite(token, deps)).toMatchObject({ error: REDEEM_NEED_EMAIL, needEmail: true })
    expect(world.w.log).not.toContain('claim')
  })

  it('uses the email the admin typed without asking', async () => {
    world.w.peek = emailLessPeek({ kind: 'owner', email: 'owner@example.com' })
    world.w.claim = ownerInvite({ listing_id: null, email: 'owner@example.com' })
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'ready', askRole: false })
    expect(await redeemTesterInvite(token, deps)).toMatchObject({ ok: true, firstStop: '/dashboard' })
    expect(world.w.inserted).toEqual([
      { tester_user_id: 'new-1', listing_id: null, is_owner: true, invited_by: 'admin-1' },
    ])
  })

  it('switches a live supporter enrollment to owner and keeps its progress', async () => {
    world.w.users.set('u-session', 'me@example.com')
    deps.sessionUserId.mockResolvedValue('u-session')
    world.w.liveEnrollment = { id: 'enr-live', listing_id: null, is_owner: false }
    expect(await redeemTesterInvite(token, deps)).toMatchObject({ ok: true })
    expect(world.w.inserted).toEqual([])
    expect(world.w.upgraded).toEqual({
      payload: { is_owner: true },
      filters: ['eq:id=enr-live', 'is:ended_at=null'],
    })
  })

  it('leaves a live enrollment that already has a listing alone', async () => {
    world.w.users.set('u-session', 'me@example.com')
    deps.sessionUserId.mockResolvedValue('u-session')
    world.w.liveEnrollment = { id: 'enr-live', listing_id: 'lst-9', is_owner: true }
    expect(await redeemTesterInvite(token, deps)).toMatchObject({ ok: true })
    expect(world.w.upgraded).toBeNull()
    expect(world.w.inserted).toEqual([])
  })

  it('fails before sign-in when the switch to owner errors', async () => {
    world.w.users.set('u-session', 'me@example.com')
    deps.sessionUserId.mockResolvedValue('u-session')
    world.w.liveEnrollment = { id: 'enr-live', listing_id: null, is_owner: false }
    world.w.upgradeError = { code: '40001' }
    expect(await redeemTesterInvite(token, deps)).toEqual({ ok: false, error: REDEEM_FAILED })
    expect(deps.signIn).not.toHaveBeenCalled()
  })
})

describe('redeemTesterInvite: shared links', () => {
  // One link that can be posted anywhere (founder, 2026-10-13): never bound,
  // each person picks owner or supporter, and the test holds 15 live testers.
  beforeEach(() => {
    world.w.peek = emailLessPeek({ kind: 'shared', id: 'inv-3', created_by: 'admin-1', max_uses: 15 })
    world.w.claim = { id: 'inv-3', kind: 'shared', email: null, listing_id: null, tester_user_id: null, created_by: 'admin-1' }
    world.w.liveCount = 3
  })

  it('asks a new person for their role and email on /t', async () => {
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'email', askRole: true })
    world.w.users.set('u-session', 'me@example.com')
    deps.sessionUserId.mockResolvedValue('u-session')
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'session', askRole: true })
  })

  it('ignores an admin session and asks for an email instead', async () => {
    deps.sessionUserId.mockResolvedValue('u-admin')
    deps.isAdmin.mockImplementation(async (id: string) => id === 'u-admin')
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'email', askRole: true })
  })

  it.each([[''], ['admin'], ['Owner ']])('asks for a role (%j) before anything else, spending no use', async (role) => {
    expect(await redeemTesterInvite(token, deps, 'new@example.com', role)).toEqual({
      ok: false,
      error: REDEEM_NEED_ROLE,
      needRole: true,
      needEmail: true,
    })
    expect(world.w.log).not.toContain('claim')
    expect(world.w.created).toEqual([])
  })

  it('makes an owner: new account, enrolled as an owner with no page, first stop /dashboard, never bound', async () => {
    const result = await redeemTesterInvite(token, deps, 'New.Owner@Example.com', 'owner')
    expect(result).toEqual({
      ok: true,
      inviteId: 'inv-3',
      testerUserId: 'new-1',
      createdBy: 'admin-1',
      firstStop: '/dashboard',
    })
    expect(world.w.bound).toBeNull()
    expect(world.w.inserted).toEqual([
      { tester_user_id: 'new-1', listing_id: null, is_owner: true, invited_by: 'admin-1' },
    ])
    expect(world.w.log).toEqual([
      'peek',
      'count',
      'claim',
      'createUser',
      'enroll:lookup',
      'enroll:insert',
      'generateLink:new.owner@example.com',
      'signIn',
    ])
  })

  it('makes a supporter: enrolled without a listing, first stop /search', async () => {
    const result = await redeemTesterInvite(token, deps, 'fan@example.com', 'supporter')
    expect(result).toMatchObject({ ok: true, testerUserId: 'new-1', firstStop: '/search' })
    expect(world.w.bound).toBeNull()
    expect(world.w.inserted).toEqual([
      { tester_user_id: 'new-1', listing_id: null, is_owner: false, invited_by: 'admin-1' },
    ])
  })

  it('lets the next person in through the same link with their own account', async () => {
    await redeemTesterInvite(token, deps, 'first@example.com', 'supporter')
    await redeemTesterInvite(token, deps, 'second@example.com', 'owner')
    expect(world.w.inserted.map((r) => r.tester_user_id)).toEqual(['new-1', 'new-2'])
    expect(world.w.bound).toBeNull()
  })

  it('puts the tour on a signed-in person who is not on it yet', async () => {
    world.w.users.set('u-session', 'me@example.com')
    deps.sessionUserId.mockResolvedValue('u-session')
    expect(await redeemTesterInvite(token, deps, '', 'supporter')).toMatchObject({
      ok: true,
      testerUserId: 'u-session',
    })
    expect(world.w.created).toEqual([])
    expect(world.w.bound).toBeNull()
  })

  it('never signs in to an email that already has an account', async () => {
    world.w.users.set('u-someone', 'someone@example.com')
    expect(await redeemTesterInvite(token, deps, 'someone@example.com', 'owner')).toEqual({
      ok: false,
      error: REDEEM_EMAIL_TAKEN,
      needEmail: true,
    })
    expect(world.w.log).not.toContain('claim')
  })

  it('sends a tester already on the tour straight back in, spending nothing', async () => {
    world.w.users.set('u-session', 'me@example.com')
    deps.sessionUserId.mockResolvedValue('u-session')
    world.w.liveEnrollment = { id: 'enr-live', listing_id: null, is_owner: true }
    world.w.liveCount = 15
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'returning', askRole: false })
    expect(await redeemTesterInvite(token, deps)).toEqual({
      ok: true,
      inviteId: 'inv-3',
      testerUserId: 'u-session',
      createdBy: 'admin-1',
      firstStop: '/dashboard',
      returning: true,
    })
    expect(world.w.log).not.toContain('claim')
    expect(world.w.inserted).toEqual([])
    expect(deps.signIn).not.toHaveBeenCalled()
  })

  it('sends a returning supporter, or an owner with a page, to /search', async () => {
    world.w.users.set('u-session', 'me@example.com')
    deps.sessionUserId.mockResolvedValue('u-session')
    world.w.liveEnrollment = { id: 'enr-live', listing_id: 'lst-1', is_owner: true }
    expect(await redeemTesterInvite(token, deps)).toMatchObject({ firstStop: '/search', returning: true })
    world.w.liveEnrollment = { id: 'enr-live', listing_id: null, is_owner: false }
    expect(await redeemTesterInvite(token, deps)).toMatchObject({ firstStop: '/search', returning: true })
  })

  it('reads full at 15 live testers, before the role, and spends nothing', async () => {
    world.w.liveCount = 15
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'full', askRole: false })
    expect(await redeemTesterInvite(token, deps, 'late@example.com', 'owner')).toEqual({
      ok: false,
      error: REDEEM_FULL,
      full: true,
    })
    expect(world.w.log).not.toContain('claim')
    expect(world.w.created).toEqual([])
  })

  it('reads full once the link has let in as many people as the test holds', async () => {
    world.w.peek = emailLessPeek({ kind: 'shared', id: 'inv-3', created_by: 'admin-1', use_count: 15, max_uses: 15 })
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'full', askRole: false })
    expect(await redeemTesterInvite(token, deps, 'late@example.com', 'owner')).toMatchObject({ full: true })
    expect(world.w.log).not.toContain('claim')
  })

  it('reads a revoked or expired shared link as ready, never as full', async () => {
    world.w.liveCount = 15
    world.w.peek = emailLessPeek({ kind: 'shared', revoked_at: '2026-10-10T00:00:00Z' })
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'ready', askRole: false })
    world.w.peek = emailLessPeek({ kind: 'shared', expires_at: '2026-01-01T00:00:00Z' })
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'ready', askRole: false })
  })

  it('shows full when the cap refuses the enrollment after the claim, without signing in', async () => {
    world.w.insertError = { code: 'P0001', message: 'tester_cap_full' }
    expect(await redeemTesterInvite(token, deps, 'racer@example.com', 'supporter')).toEqual({
      ok: false,
      error: REDEEM_FULL,
      full: true,
    })
    expect(deps.signIn).not.toHaveBeenCalled()
  })

  it('fails on another P0001 error rather than calling it full', async () => {
    world.w.insertError = { code: 'P0001', message: 'something else' }
    expect(await redeemTesterInvite(token, deps, 'racer@example.com', 'supporter')).toEqual({
      ok: false,
      error: REDEEM_FAILED,
    })
  })

  it('fails when the count errors, and spends no use', async () => {
    world.w.countError = { code: '57014' }
    expect(await redeemTesterInvite(token, deps, 'new@example.com', 'owner')).toEqual({
      ok: false,
      error: REDEEM_FAILED,
    })
    expect(world.w.log).not.toContain('claim')
    expect(await testerLinkStart(token, deps)).toEqual({ mode: 'ready', askRole: false })
  })

  it('refuses a claimed shared row that never went through the role check', async () => {
    // The peek saw nothing, then the claim still returned a shared row.
    world.w.peek = null
    expect(await redeemTesterInvite(token, deps, 'new@example.com', 'owner')).toEqual({
      ok: false,
      error: REDEEM_FAILED,
    })
    expect(world.w.created).toEqual([])
    expect(world.w.inserted).toEqual([])
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
    world.w.liveEnrollment = { id: 'enr-live', listing_id: null, is_owner: false }
    expect(await redeemTesterInvite(token, deps)).toMatchObject({ ok: true })
    expect(world.w.inserted).toEqual([])
    expect(world.w.upgraded).toBeNull()
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
    world.w.peek = emailLessPeek()
    world.w.peekError = { code: '57014' }
    await redeemTesterInvite(token, deps, 'typed@example.com')
    world.w.peekError = null
    world.w.claim = supporterInvite({ email: null })
    world.w.insertError = null
    world.w.createError = { code: 'unexpected_failure' }
    await redeemTesterInvite(token, deps, 'typed@example.com')
    const logged = JSON.stringify(spy.mock.calls)
    expect(spy).toHaveBeenCalled()
    expect(logged).not.toContain(token)
    expect(logged).not.toContain(hashTesterToken(token))
    expect(logged).not.toContain('@')
  })
})
