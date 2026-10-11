import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/supabase/types'
import { hashTesterToken, isWellFormedTesterToken, normalizeTesterEmail } from '@/lib/tester/links'

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
 */

export const REDEEM_MISSING = 'This link is missing its code. Ask for a new one.'
export const REDEEM_EXPIRED = 'This link has expired or was already used. Ask for a new one.'
export const REDEEM_FAILED = 'Something went wrong. Tap Start again.'
export const REDEEM_RATE_LIMITED = 'Too many tries from here. Wait a few minutes and tap Start again.'
export const REDEEM_NEED_EMAIL = 'Type your email to start.'
export const REDEEM_BAD_EMAIL = 'That email doesn’t look right. Check it and tap Start again.'
export const REDEEM_EMAIL_TAKEN =
  'That email already has an account. Sign in first, then open this link again.'

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
  | { ok: true; inviteId: string; testerUserId: string; createdBy: string | null }
  | { ok: false; error: string; needEmail?: true }

/**
 * What /t should show before Start: an email box, a note that the tour goes on
 * the signed-in account, or just the button. A dead link reads as 'ready' so
 * the page gives nothing away; Start then shows the expired message.
 */
export type TesterLinkStart = 'email' | 'session' | 'ready'

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

export async function redeemTesterInvite(
  token: string,
  deps: RedeemDeps,
  typedEmail = ''
): Promise<RedeemResult> {
  if (!isWellFormedTesterToken(token)) {
    return { ok: false, error: token ? REDEEM_EXPIRED : REDEEM_MISSING }
  }

  if (!(await deps.allowAttempt())) return { ok: false, error: REDEEM_RATE_LIMITED }

  const { service } = deps
  const tokenHash = hashTesterToken(token)

  // A live supporter link with no email and no account yet: pick the account
  // now, so asking for an email or refusing one spends nothing.
  let newAccount: NewAccount | null = null
  try {
    const start = await startFor(service, tokenHash, deps)
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

  try {
    const account =
      invite.kind === 'owner'
        ? await resolveOwner(invite, service)
        : await resolveSupporter(invite, service, newAccount)

    // Defense in depth: mint refuses admins too, but roles change, and a link
    // must never become a way into an admin session.
    if (await deps.isAdmin(account.userId)) throw new RedeemRefused('admin account')

    if (invite.tester_user_id === null) {
      const { error: bindError } = await service
        .from('tester_invites')
        .update({ tester_user_id: account.userId })
        .eq('id', invite.id)
        .is('tester_user_id', null)
      if (bindError) throw new Error(`bind ${bindError.code}`)
    }

    // Enroll before signing in, so a retry after a failed sign-in finds the
    // enrollment rather than making a second one.
    await ensureEnrollment(service, account.userId, invite)

    const { data: link, error: linkError } = await service.auth.admin.generateLink({
      type: 'magiclink',
      email: account.email,
    })
    const hashedToken = link?.properties?.hashed_token
    if (linkError || !hashedToken) throw new Error(`generateLink ${linkError?.code ?? 'empty'}`)

    const { error: signInError } = await deps.signIn(hashedToken)
    if (signInError) throw new Error('verifyOtp failed')

    return { ok: true, inviteId: invite.id, testerUserId: account.userId, createdBy: invite.created_by }
  } catch (err) {
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
  if (!isWellFormedTesterToken(token)) return 'ready'
  try {
    return (await startFor(deps.service, hashTesterToken(token), deps)).kind
  } catch (err) {
    console.error('[testerLinkStart]', err instanceof Error ? err.message : 'unknown')
    return 'ready'
  }
}

async function startFor(
  service: SupabaseClient<Database>,
  tokenHash: string,
  deps: Pick<RedeemDeps, 'isAdmin' | 'sessionUserId'>
): Promise<{ kind: 'session'; userId: string } | { kind: 'email' | 'ready' }> {
  const { data: invite, error } = await service
    .from('tester_invites')
    .select('kind, email, tester_user_id, revoked_at, expires_at, use_count, max_uses')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (error) throw new Error(`peek ${error.code}`)

  const needsAccount =
    invite !== null &&
    invite.kind === 'supporter' &&
    invite.email === null &&
    invite.tester_user_id === null &&
    invite.revoked_at === null &&
    new Date(invite.expires_at).getTime() > Date.now() &&
    invite.use_count < invite.max_uses
  if (!needsAccount) return { kind: 'ready' }

  // An admin's own session never takes a link. The founder opening a link to
  // check it gets the email box like anyone else, not a refusal.
  const sessionUserId = (await deps.sessionUserId?.()) ?? null
  if (sessionUserId && !(await deps.isAdmin(sessionUserId))) {
    return { kind: 'session', userId: sessionUserId }
  }
  return { kind: 'email' }
}

async function emailForUser(service: SupabaseClient<Database>, userId: string): Promise<string> {
  const { data, error } = await service.auth.admin.getUserById(userId)
  const email = data?.user?.email
  if (error || !email) throw new Error('user lookup')
  return email
}

/**
 * Owner links sign in as whoever owns the listing now, with the checks the
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
 * Supporter links land on the bound account after the first use. Before that:
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
    if (!newAccount) throw new RedeemRefused('supporter link without email')
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
 * already on the tour keeps the enrollment they have, listing and all.
 */
async function ensureEnrollment(
  service: SupabaseClient<Database>,
  userId: string,
  invite: ClaimedInvite
): Promise<void> {
  const { data: live, error: liveError } = await service
    .from('tour_enrollments')
    .select('id')
    .eq('tester_user_id', userId)
    .is('ended_at', null)
    .maybeSingle()
  if (liveError) throw new Error(`enrollment lookup ${liveError.code}`)
  if (live) return

  const { error: insertError } = await service.from('tour_enrollments').insert({
    tester_user_id: userId,
    listing_id: invite.kind === 'owner' ? invite.listing_id : null,
    invited_by: invite.created_by,
  })
  if (insertError && insertError.code !== '23505') {
    throw new Error(`enrollment insert ${insertError.code}`)
  }
}
