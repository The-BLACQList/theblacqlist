'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { getAdminRole, getAdminSession, writeAuditLog } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import {
  TESTER_LINK_MAX_USES,
  TESTER_LINK_TTL_DAYS,
  buildTesterLink,
  generateTesterToken,
  hashTesterToken,
  normalizeTesterEmail,
  normalizeTesterLabel,
  originFromHeaders,
} from '@/lib/tester/links'

export type MintTesterLinkState =
  | { success: true; link: string; label: string; existingAccount: boolean }
  | { error: string }
  | null

export type RevokeTesterLinkState = { success: true } | { error: string } | null

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ADMIN_ACCOUNT_REFUSAL =
  'That account is an admin. A link signs in as its account, so admins can never get one.'

/**
 * Make a one-tap tester link. The raw token exists only in this function and
 * in the state returned to the admin's browser, once. The database gets its
 * SHA-256; the audit log gets the invite id and label. Never log `token` or
 * `link` here: a link is a login.
 *
 * Supporter links name an email (D4). Owner links name a listing and use
 * whoever owns it, with the same checks inviteTesterAction runs.
 */
export async function mintTesterLinkAction(
  _prev: MintTesterLinkState,
  formData: FormData
): Promise<MintTesterLinkState> {
  const admin = await getAdminSession()
  if (!admin) return { error: 'You must be signed in as an admin.' }

  const kind = formData.get('kind')?.toString()
  if (kind !== 'supporter' && kind !== 'owner') return { error: 'Pick supporter or owner.' }

  const label = normalizeTesterLabel(formData.get('label')?.toString() ?? '')
  if (!label) return { error: 'Add a short label such as T-07, up to 40 characters.' }

  const serviceClient = createServiceClient()

  let email: string | null = null
  let listingId: string | null = null
  let existingAccount = false

  if (kind === 'supporter') {
    email = normalizeTesterEmail(formData.get('email')?.toString() ?? '')
    if (!email) return { error: 'Enter a valid email for the supporter.' }

    const { data: existingId, error: lookupError } = await serviceClient.rpc(
      'find_auth_user_id_by_email',
      { p_email: email }
    )
    if (lookupError) {
      console.error('[mintTesterLinkAction] account lookup', lookupError.code)
      return { error: 'Failed to check that email. Please try again.' }
    }
    if (existingId) {
      if (await getAdminRole(existingId)) return { error: ADMIN_ACCOUNT_REFUSAL }
      existingAccount = true
    }
  } else {
    const listingRef = formData.get('listing')?.toString().trim() ?? ''
    if (!listingRef) return { error: 'Enter a listing ID or slug.' }

    const listingQuery = serviceClient
      .from('listings')
      .select('id, name, status, owner_user_id, deleted_at')
    const { data: listing, error: listingError } = await (UUID_PATTERN.test(listingRef)
      ? listingQuery.eq('id', listingRef)
      : listingQuery.eq('slug', listingRef)
    ).maybeSingle()

    if (listingError) {
      console.error('[mintTesterLinkAction] listing lookup', listingError.code)
      return { error: 'Failed to look up the listing. Please try again.' }
    }
    if (!listing || listing.deleted_at !== null) {
      return { error: `No listing found for “${listingRef}”.` }
    }
    if (!listing.owner_user_id) {
      return { error: 'This listing has no owner account yet, so there is no one to sign in as.' }
    }
    if (listing.status !== 'published') {
      return { error: `“${listing.name}” is not published. Publish it first.` }
    }
    if (await getAdminRole(listing.owner_user_id)) return { error: ADMIN_ACCOUNT_REFUSAL }
    listingId = listing.id
  }

  const origin = originFromHeaders(await headers())
  if (!origin) return { error: 'Could not work out this site’s address. Please try again.' }

  const token = generateTesterToken()
  const expiresAt = new Date(Date.now() + TESTER_LINK_TTL_DAYS * 24 * 60 * 60 * 1000)

  const { data: invite, error: insertError } = await serviceClient
    .from('tester_invites')
    .insert({
      token_hash: hashTesterToken(token),
      kind,
      email,
      listing_id: listingId,
      label,
      max_uses: TESTER_LINK_MAX_USES,
      expires_at: expiresAt.toISOString(),
      created_by: admin.user.id,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[mintTesterLinkAction] insert', insertError.code)
    return { error: 'Failed to make the link. Please try again.' }
  }

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: 'mint_tester_link',
    targetTable: 'tester_invites',
    targetId: invite.id,
    afterState: { kind, label, listing_id: listingId, existing_account: existingAccount },
  })

  revalidatePath('/admin/testers')
  return { success: true, link: buildTesterLink(origin, token), label, existingAccount }
}

/**
 * Revoke a link. The next tap on it gets the generic expired message. Accounts
 * and enrollments it already created stay, as they would after expiry.
 */
export async function revokeTesterLinkAction(
  _prev: RevokeTesterLinkState,
  formData: FormData
): Promise<RevokeTesterLinkState> {
  const admin = await getAdminSession()
  if (!admin) return { error: 'You must be signed in as an admin.' }

  const inviteId = formData.get('invite_id')?.toString().trim() ?? ''
  if (!UUID_PATTERN.test(inviteId)) return { error: 'Invalid link.' }

  const serviceClient = createServiceClient()

  // Same zero-row trick as endTesterEnrollmentAction: a double revoke is
  // observable instead of silently re-stamping revoked_at.
  const revokedAt = new Date().toISOString()
  const { data: updated, error: updateError } = await serviceClient
    .from('tester_invites')
    .update({ revoked_at: revokedAt })
    .eq('id', inviteId)
    .is('revoked_at', null)
    .select('id')

  if (updateError) {
    console.error('[revokeTesterLinkAction]', updateError.code)
    return { error: 'Failed to revoke the link. Please try again.' }
  }
  if (!updated || updated.length === 0) {
    return { error: 'This link was not found or is already revoked.' }
  }

  void writeAuditLog({
    adminUserId: admin.user.id,
    action: 'revoke_tester_link',
    targetTable: 'tester_invites',
    targetId: inviteId,
    beforeState: { revoked_at: null },
    afterState: { revoked_at: revokedAt },
  })

  revalidatePath('/admin/testers')
  return { success: true }
}
