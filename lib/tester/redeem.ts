import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'
import {
  TESTER_CAP,
  hashTesterToken,
  isWellFormedTesterToken,
  normalizeTesterEmail,
  parseTesterRole,
  type TesterRole,
} from '@/lib/tester/links'
import { isTesterCapFull } from '@/lib/tester/cap'

/**
 * Redeem a one-tap tester link: claim a use, find or make the account, enroll
 * it in the tour, and sign the browser in. Kept out of the 'use server' file so
 * every branch can be tested with plain doubles; lib/actions/tester/
 * redeemTesterLink.ts wires the real clients and then sets cookies and
 * redirects.
 *
 * The caller sees a handful of messages and none of them says why a link
 * failed: an expired, revoked, used-up and made-up link all read the same.
 * Never log the token, its hash or an email from here.
 *
 * A supporter link may be made without an email (founder, 2026-10-11). The
 * first tap then needs an account to land on, and gets one of two:
 *   - the account the browser is already signed in to, if it is not an admin;
 *   - a NEW account for the email the tester types on /t.
 * A typed email never signs in to an account that already exists. The tester
 * is sent to normal sign-in instead, so a forwarded link can't be used to get
 * into someone else's account. All of this is checked before the claim, so
 * asking for an email or turning one down spends no use.
 *
 * An owner link may be made without a listing, for an owner who has no page
 * yet (founder, 2026-10-11). It finds or makes the account exactly like a
 * supporter link, enrolls the account as an owner with no listing, and sends
 * the tester to /dashboard to claim or create their page. The free month finds
 * the page later (lib/tour/freeMonth.ts).
 *
 * A shared link (founder, 2026-10-13) is one link that can be posted or
 * forwarded. It names no one and is never bound. Each new person picks "I own
 * a business" or "I support Black-owned businesses" on /t, gets their own
 * account the same way an email-less link makes one, and is enrolled as an
 * owner (first stop /dashboard) or a supporter (first stop /search). A tester
 * already on the tour who opens it while signed in spends nothing and goes
 * straight back in.
 *
 * The test holds TESTER_CAP live testers in total. The database trigger is the
 * real limit and covers every kind of link; a shared link also checks before
 * the claim, so a full test spends nothing and shows REDEEM_FULL. If the
 * trigger refuses an enrollment after the claim, the use is spent and any
 * account just made stays as a plain supporter account with no tour.
 */

export const REDEEM_MISSING = 'This link is missing its code. Ask for a new one.'
export const REDEEM_EXPIRED = 'This link has expired or was already used. Ask for a new one.'
export const REDEEM_FAILED = 'Something went wrong. Tap Start again.'
export const REDEEM_RATE_LIMITED = 'Too many tries from here. Wait a few minutes and tap Start again.'
export const REDEEM_NEED_EMAIL = 'Type your email to start.'
export const REDEEM_BAD_EMAIL = 'That email doesn’t look right. Check it and tap Start again.'
export const REDEEM_EMAIL_TAKEN =
  'That email already has an account. Sign in first, then open this link again.'
export const REDEEM_NEED_ROLE = 'Pick the one that fits you best, then tap Start.'
export const REDEEM_FULL = 'This test is full. Thanks for wanting to help!'

export interface RedeemDeps {
  service: SupabaseClient<Database>
  /** Charges one try against the caller. False means over the limit. */
  allowAttempt: () => Promise<boolean>
  isAdmin: (userId: string) => Promise<boolean>
  /** verifyOtp on the request's own client, so the session lands in its cookies. */
  signIn: (tokenHash: string) => Promise<{ error: unknown }>
  /** The account this browser is already signed in to, if any. */
  sessionUserId?: () => Promise<string | null>
}

export type RedeemResult =
  | {
      ok: true
      inviteId: string
      testerUserId: string
      createdBy: string | null
      /** Where Start lands: the create-your-page choices for an owner with no
       *  page yet, search for everyone else. */
      firstStop: '/dashboard' | '/search'
      /** A tester already on the tour came back through a shared link. No use
       *  was spent and nothing was written. */
      returning?: true
    }
  | { ok: false; error: string; needEmail?: true; needRole?: true; full?: true }

/**
 * What /t should show before Start.
 *   mode 'email':     the email box.
 *   mode 'session':   a note that the tour goes on the signed-in account.
 *   mode 'returning': a tester already on the tour, back through a shared link.
 *   mode 'full':      the test is full (shared links only).
 *   mode 'ready':     just the button.
 * askRole: a shared link asks a new tester whether they own a business.
 * A dead link reads as 'ready' so the page gives nothing away; Start then
 * shows the expired message.
 */
export type TesterLinkStart = {
  mode: 'email' | 'session' | 'returning' | 'full' | 'ready'
  askRole: boolean
}

type StartPick =
  | { kind: 'session'; userId: string; askRole: boolean }
  | {
      kind: 'returning'
      userId: string
      inviteId: string
      createdBy: string | null
      firstStop: '/dashboard' | '/search'
    }
  | { kind: 'email'; askRole: boolean }
  | { kind: 'full' | 'ready' }

interface ClaimedInvite {
  id: string
  kind: string
  email: string | null
  listing_id: string | null
  tester_user_id: string | null
  created_by: string | null
}

/** The account a link with no email lands on, picked before the claim. */
type NewAccount = { kind: 'session'; userId: string } | { kind: 'typed'; email: string }

class RedeemRefused extends Error {}
class EmailTaken extends Error {}
class CapFull extends Error {}

export async function redeemTesterInvite(
  token: string,
  deps: RedeemDeps,
  typedEmail = '',
  typedRole = ''
): Promise<RedeemResult> {
  if (!isWellFormedTesterToken(token)) {
    return { ok: false, error: token ? REDEEM_EXPIRED : REDEEM_MISSING }
  }

  if (!(await deps.allowAttempt())) return { ok: false, error: REDEEM_RATE_LIMITED }

  const { service } = deps
  const tokenHash = hashTesterToken(token)

  // A live link with no email, no listing and no account yet: pick the
  // account now, so asking for an email or refusing one spends nothing.
  let newAccount: NewAccount | null = null
  let role: TesterRole | null = null
  try {
    const start = await startFor(service, tokenHash, deps)
    if (start.kind === 'full') return { ok: false, error: REDEEM_FULL, full: true }
    if (start.kind === 'returning') {
      return {
        ok: true,
        inviteId: start.inviteId,
        testerUserId: start.userId,
        createdBy: start.createdBy,
        firstStop: start.firstStop,
        returning: true,
      }
    }
    if ((start.kind === 'session' || start.kind === 'email') && start.askRole) {
      role = parseTesterRole(typedRole)
      if (!role) {
        return {
          ok: false,
          error: REDEEM_NEED_ROLE,
          needRole: true,
          needEmail: start.kind === 'email' || undefined,
        }
      }
    }
    if (start.kind === 'session') {
      newAccount = { kind: 'session', userId: start.userId }
    } else if (start.kind === 'email') {
      if (!typedEmail.trim()) return { ok: false, error: REDEEM_NEED_EMAIL, needEmail: true }
      const email = normalizeTesterEmail(typedEmail)
      if (!email) return { ok: false, error: REDEEM_BAD_EMAIL, needEmail: true }
      if (await findUserIdByEmail(service, email)) {
        return { ok: false, error: REDEEM_EMAIL_TAKEN, needEmail: true }
      }
      newAccount = { kind: 'typed', email }
    }
  } catch (err) {
    console.error('[redeemTesterInvite] peek', err instanceof Error ? err.message : 'unknown')
    return { ok: false, error: REDEEM_FAILED }
  }

  // One atomic UPDATE claims the use. Zero rows covers every reason a link is
  // dead, and the reason is never shown.
  const { data: claimed, error: claimError } = await service.rpc('redeem_tester_invite', {
    p_token_hash: tokenHash,
  })
  if (claimError) {
    console.error('[redeemTesterInvite] claim', claimError.code)
    return { ok: false, error: REDEEM_FAILED }
  }
  const invite = (claimed as ClaimedInvite[] | null)?.[0]
  if (!invite) return { ok: false, error: REDEEM_EXPIRED }
  // The peek and the claim read the same row, so a shared link always came
  // through the role check above. Refuse rather than guess if it somehow didn't.
  if (invite.kind === 'shared' && !role) return { ok: false, error: REDEEM_FAILED }
  const isOwner = invite.kind === 'owner' || role === 'owner'

  try {
    // An owner link with a listing signs in as that listing's owner. Every
    // other link (a supporter, or an owner with no page yet) lands on its own
    // account.
    const account =
      invite.kind === 'owner' && invite.listing_id !== null
        ? await resolveOwner(invite, service)
        : await resolveSupporter(invite, service, newAccount)

    // Defense in depth: mint refuses admins too, but roles change, and a link
    // must never become a way into an admin session.
    if (await deps.isAdmin(account.userId)) throw new RedeemRefused('admin account')

    // A shared link is never bound: each person who taps it is someone new.
    if (invite.tester_user_id === null && invite.kind !== 'shared') {
      const { error: bindError } = await service
        .from('tester_invites')
        .update({ tester_user_id: account.userId })
        .eq('id', invite.id)
        .is('tester_user_id', null)
      if (bindError) throw new Error(`bind ${bindError.code}`)
    }

    // Enroll before signing in, so a retry after a failed sign-in finds the
    // enrollment rather than making a second one.
    await ensureEnrollment(service, account.userId, invite, isOwner)

    const { data: link, error: linkError } = await service.auth.admin.generateLink({
      type: 'magiclink',
      email: account.email,
    })
    const hashedToken = link?.properties?.hashed_token
    if (linkError || !hashedToken) throw new Error(`generateLink ${linkError?.code ?? 'empty'}`)

    const { error: signInError } = await deps.signIn(hashedToken)
    if (signInError) throw new Error('verifyOtp failed')

    return {
      ok: true,
      inviteId: invite.id,
      testerUserId: account.userId,
      createdBy: invite.created_by,
      firstStop: isOwner && invite.listing_id === null ? '/dashboard' : '/search',
    }
  } catch (err) {
    if (err instanceof CapFull) {
      console.error('[redeemTesterInvite] test full', invite.id)
      return { ok: false, error: REDEEM_FULL, full: true }
    }
    if (err instanceof EmailTaken) {
      console.error('[redeemTesterInvite] typed email taken', invite.id)
      return { ok: false, error: REDEEM_EMAIL_TAKEN, needEmail: true }
    }
    if (err instanceof RedeemRefused) {
      console.error('[redeemTesterInvite] refused', invite.id, err.message)
      return { ok: false, error: REDEEM_EXPIRED }
    }
    console.error('[redeemTesterInvite] failed', invite.id, err instanceof Error ? err.message : 'unknown')
    return { ok: false, error: REDEEM_FAILED }
  }
}

/**
 * What /t should ask for before Start. Read only: it spends no use. Any error
 * reads as 'ready', and Start asks for the email then if it is still needed.
 */
export async function testerLinkStart(
  token: string,
  deps: Pick<RedeemDeps, 'service' | 'isAdmin' | 'sessionUserId'>
): Promise<TesterLinkStart> {
  const ready: TesterLinkStart = { mode: 'ready', askRole: false }
  if (!isWellFormedTesterToken(token)) return ready
  try {
    const start = await startFor(deps.service, hashTesterToken(token), deps)
    return {
      mode: start.kind,
      askRole: (start.kind === 'session' || start.kind === 'email') && start.askRole,
    }
  } catch (err) {
    console.error('[testerLinkStart]', err instanceof Error ? err.message : 'unknown')
    return ready
  }
}

async function startFor(
  service: SupabaseClient<Database>,
  tokenHash: string,
  deps: Pick<RedeemDeps, 'isAdmin' | 'sessionUserId'>
): Promise<StartPick> {
  const { data: invite, error } = await service
    .from('tester_invites')
    .select(
      'id, kind, email, listing_id, tester_user_id, revoked_at, expires_at, use_count, max_uses, created_by'
    )
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (error) throw new Error(`peek ${error.code}`)
  if (
    !invite ||
    invite.revoked_at !== null ||
    new Date(invite.expires_at).getTime() <= Date.now()
  ) {
    return { kind: 'ready' }
  }

  // An admin's own session never takes a link. The founder opening a link to
  // check it gets the email box like anyone else, not a refusal.
  const sessionUserId = async (): Promise<string | null> => {
    const id = (await deps.sessionUserId?.()) ?? null
    return id && !(await deps.isAdmin(id)) ? id : null
  }

  if (invite.kind === 'shared') {
    const userId = await sessionUserId()
    const live = userId ? await liveEnrollment(service, userId) : null
    if (userId && live) {
      return {
        kind: 'returning',
        userId,
        inviteId: invite.id,
        createdBy: invite.created_by,
        firstStop: live.is_owner && live.listing_id === null ? '/dashboard' : '/search',
      }
    }
    // A used-up shared link has let in as many people as the test holds.
    if (invite.use_count >= invite.max_uses || (await liveTesterCount(service)) >= TESTER_CAP) {
      return { kind: 'full' }
    }
    return userId ? { kind: 'session', userId, askRole: true } : { kind: 'email', askRole: true }
  }

  const needsAccount =
    invite.listing_id === null &&
    invite.email === null &&
    invite.tester_user_id === null &&
    invite.use_count < invite.max_uses
  if (!needsAccount) return { kind: 'ready' }

  const userId = await sessionUserId()
  return userId ? { kind: 'session', userId, askRole: false } : { kind: 'email', askRole: false }
}

async function liveEnrollment(
  service: SupabaseClient<Database>,
  userId: string
): Promise<{ id: string; listing_id: string | null; is_owner: boolean } | null> {
  const { data, error } = await service
    .from('tour_enrollments')
    .select('id, listing_id, is_owner')
    .eq('tester_user_id', userId)
    .is('ended_at', null)
    .maybeSingle()
  if (error) throw new Error(`enrollment lookup ${error.code}`)
  return data
}

async function liveTesterCount(service: SupabaseClient<Database>): Promise<number> {
  const { count, error } = await service
    .from('tour_enrollments')
    .select('id', { count: 'exact', head: true })
    .is('ended_at', null)
  if (error || count === null) throw new Error(`tester count ${error?.code ?? 'empty'}`)
  return count
}

async function emailForUser(service: SupabaseClient<Database>, userId: string): Promise<string> {
  const { data, error } = await service.auth.admin.getUserById(userId)
  const email = data?.user?.email
  if (error || !email) throw new Error('user lookup')
  return email
}

/**
 * Owner links with a listing sign in as whoever owns the listing now, with the checks the
 * mint ran, run again: a listing can be unpublished or change hands inside
 * fourteen days. Once bound, a link never follows the listing to a new owner.
 */
async function resolveOwner(
  invite: ClaimedInvite,
  service: SupabaseClient<Database>
): Promise<{ userId: string; email: string }> {
  if (!invite.listing_id) throw new RedeemRefused('owner link without listing')

  const { data: listing, error } = await service
    .from('listings')
    .select('id, status, owner_user_id, deleted_at')
    .eq('id', invite.listing_id)
    .maybeSingle()
  if (error) throw new Error(`listing ${error.code}`)
  if (!listing || listing.deleted_at !== null || listing.status !== 'published' || !listing.owner_user_id) {
    throw new RedeemRefused('listing no longer eligible')
  }
  if (invite.tester_user_id !== null && invite.tester_user_id !== listing.owner_user_id) {
    throw new RedeemRefused('listing changed owner')
  }

  return { userId: listing.owner_user_id, email: await emailForUser(service, listing.owner_user_id) }
}

/**
 * Supporter links, and owner links with no listing, land on the bound account
 * after the first use. Before that:
 * the account with the link's email if there is one, else a new one with the
 * email already confirmed, since holding the link is the proof. A link with no
 * email uses the account picked before the claim (see the header).
 */
async function resolveSupporter(
  invite: ClaimedInvite,
  service: SupabaseClient<Database>,
  newAccount: NewAccount | null
): Promise<{ userId: string; email: string }> {
  if (invite.tester_user_id) {
    return { userId: invite.tester_user_id, email: await emailForUser(service, invite.tester_user_id) }
  }
  if (!invite.email) {
    if (!newAccount) throw new RedeemRefused('link without email or listing')
    if (newAccount.kind === 'session') {
      return { userId: newAccount.userId, email: await emailForUser(service, newAccount.userId) }
    }
    return createTypedAccount(service, newAccount.email)
  }

  const existing = await findUserIdByEmail(service, invite.email)
  if (existing) return { userId: existing, email: invite.email }

  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: invite.email,
    email_confirm: true,
    user_metadata: { signup_source: 'tester_link' },
  })
  if (created?.user) return { userId: created.user.id, email: invite.email }

  // Two taps at once can both reach createUser. The loser finds the winner.
  const raced = await findUserIdByEmail(service, invite.email)
  if (raced) return { userId: raced, email: invite.email }
  throw new Error(`createUser ${createError?.code ?? 'empty'}`)
}

/**
 * A typed email only ever makes a new account. If one appeared since the check
 * before the claim, refuse: unlike a link's own email, a typed one proves
 * nothing about who owns the account.
 */
async function createTypedAccount(
  service: SupabaseClient<Database>,
  email: string
): Promise<{ userId: string; email: string }> {
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { signup_source: 'tester_link' },
  })
  if (created?.user) return { userId: created.user.id, email }
  if (createError?.code === 'email_exists') throw new EmailTaken()
  throw new Error(`createUser ${createError?.code ?? 'empty'}`)
}

async function findUserIdByEmail(service: SupabaseClient<Database>, email: string): Promise<string | null> {
  const { data, error } = await service.rpc('find_auth_user_id_by_email', { p_email: email })
  if (error) throw new Error(`find user ${error.code}`)
  return data ?? null
}

/**
 * One live enrollment per tester, which a unique index also enforces. A tester
 * already on the tour keeps the enrollment they have, listing and all, with one
 * exception: a supporter who taps an owner link with no listing becomes an
 * owner, so the free month can find their page. Their walk keeps its progress.
 * A new enrollment can be refused by the cap trigger (tester_cap_full).
 */
async function ensureEnrollment(
  service: SupabaseClient<Database>,
  userId: string,
  invite: ClaimedInvite,
  isOwner: boolean
): Promise<void> {
  const live = await liveEnrollment(service, userId)
  if (live) {
    if (isOwner && !live.is_owner && live.listing_id === null) {
      const { error: upgradeError } = await service
        .from('tour_enrollments')
        .update({ is_owner: true })
        .eq('id', live.id)
        .is('ended_at', null)
      if (upgradeError) throw new Error(`enrollment owner ${upgradeError.code}`)
    }
    return
  }

  const { error: insertError } = await service.from('tour_enrollments').insert({
    tester_user_id: userId,
    listing_id: isOwner ? invite.listing_id : null,
    is_owner: isOwner,
    invited_by: invite.created_by,
  })
  if (insertError && isTesterCapFull(insertError)) throw new CapFull()
  if (insertError && insertError.code !== '23505') {
    throw new Error(`enrollment insert ${insertError.code}`)
  }
}
