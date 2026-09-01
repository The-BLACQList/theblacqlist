'use server'

import { redirect } from 'next/navigation'

import { createClient, createServiceClient } from '@/lib/supabase/server'

type DeleteAccountState = { error: string } | null

/**
 * Permanently delete the signed-in user's account.
 *
 * Data handling follows docs/blacqlist/architecture/security-and-privacy-plan.md
 * ("Account Deletion") and the live Privacy Policy §7. The database FK design does
 * most of the work on `auth.admin.deleteUser`:
 *   - CASCADE  → profiles, user_roles, saves, receipt_uploads rows are removed
 *   - SET NULL → owned listings survive but become unclaimed; authorship/audit/
 *                analytics references are anonymized; spend_events stay as
 *                de-linked anonymous aggregates (Privacy §7: not retroactively removed)
 *
 * Three things the bare cascade does NOT cover, handled explicitly here:
 *   1. Reviews (reviewer_user_id is SET NULL) — the spec says *remove* the user's
 *      reviews, so we delete them before deleting the auth user.
 *   2. Storage objects do not cascade — receipt images and the avatar are removed
 *      best-effort (the PII rows are already gone, so a storage hiccup must not
 *      block or fail the deletion the user asked for).
 *   3. Verification documents — listings.owner_user_id and claims.claimant_user_id
 *      are both SET NULL, so the rows holding `verification_docs` /
 *      `verification_doc_paths` SURVIVE the user, and with them the uploaded
 *      identity documents (registration filings, EIN letters, leases) naming the
 *      deleted person. The objects are removed and the pointer columns cleared
 *      best-effort after the auth delete succeeds.
 */
export async function deleteAccountAction(
  _prev: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  // Destructive-op guard: require the user to type DELETE.
  const confirmation = formData.get('confirm')?.toString().trim()
  if (confirmation !== 'DELETE') {
    return { error: 'Type DELETE to confirm.' }
  }

  const userId = user.id
  const service = createServiceClient()

  // Paths collected before the auth-user delete cascades the rows away.
  let receiptPaths: string[] = []
  let avatarPath: string | null = null
  // Verification documents: the rows are NOT cascaded away (both FKs are
  // SET NULL), but the *link* to the user is — after the delete there is no
  // way to find which listings/claims were theirs. Collect ids + paths now;
  // act on them only after the auth delete succeeds, so a failed deletion
  // destroys nothing.
  const listingDocIds: string[] = []
  const claimDocIds: string[] = []
  const verificationDocPaths: string[] = []

  try {
    // 1) Collect storage paths while the owning rows still exist.
    const { data: receipts } = await service
      .from('receipt_uploads')
      .select('file_path')
      .eq('user_id', userId)
    receiptPaths = (receipts ?? [])
      .map((r) => r.file_path)
      .filter((p): p is string => Boolean(p))

    const { data: profile } = await service
      .from('profiles')
      .select('avatar_url')
      .eq('id', userId)
      .maybeSingle()
    avatarPath = profile?.avatar_url ?? null

    // 1b) Verification documents on the user's listings and claims. These rows
    //     survive the auth delete (SET NULL), so this is the only moment they
    //     can still be attributed to the user.
    const { data: ownedListings } = await service
      .from('listings')
      .select('id, verification_docs')
      .eq('owner_user_id', userId)
      .not('verification_docs', 'is', null)
    for (const l of ownedListings ?? []) {
      const paths = (l.verification_docs ?? []).filter((p): p is string => Boolean(p))
      if (paths.length > 0) {
        listingDocIds.push(l.id)
        verificationDocPaths.push(...paths)
      }
    }

    const { data: userClaims } = await service
      .from('claims')
      .select('id, verification_doc_paths')
      .eq('claimant_user_id', userId)
      .not('verification_doc_paths', 'is', null)
    for (const c of userClaims ?? []) {
      const paths = (c.verification_doc_paths ?? []).filter((p): p is string => Boolean(p))
      if (paths.length > 0) {
        claimDocIds.push(c.id)
        verificationDocPaths.push(...paths)
      }
    }

    // 2) Reviews are SET NULL on user delete (anonymize) — but the data-handling
    //    spec says remove the user's reviews. Do it explicitly.
    const { error: reviewsErr } = await service
      .from('reviews')
      .delete()
      .eq('reviewer_user_id', userId)
    if (reviewsErr) {
      // Log but don't abort — the auth delete below is what matters; a stuck
      // review would surface as the deleteUser error and we want to see both.
      console.error('[deleteAccount] reviews delete failed:', reviewsErr)
    }

    // 2b) Delete the user's saves HERE, as the service role, before the auth
    //     delete. `saves` CASCADE-deletes when the auth user is removed, which
    //     fires the `saves_update_listing_save_count` trigger (an UPDATE on
    //     public.listings). auth.admin.deleteUser runs as `supabase_auth_admin`,
    //     which has no privileges on public tables, so that trigger raised
    //     "permission denied for table listings" and aborted the whole delete
    //     ("Database error deleting user"). Deleting saves as the service role
    //     (which is privileged) fires the trigger cleanly, leaving nothing for
    //     the auth-user cascade to trip over.
    const { error: savesErr } = await service.from('saves').delete().eq('user_id', userId)
    if (savesErr) {
      console.error('[deleteAccount] saves delete failed:', savesErr)
    }

    // 3) Delete the auth user. FK cascades/SET NULLs handle the relational cleanup.
    const { error: deleteErr } = await service.auth.admin.deleteUser(userId)
    if (deleteErr) {
      // Surface the real cause server-side (Vercel runtime logs / Sentry). The
      // user message stays generic; the actual Postgres/Auth error is what we
      // need to fix a failed deletion (e.g. a blocking FK or trigger).
      console.error('[deleteAccount] auth.admin.deleteUser failed:', {
        userId,
        message: deleteErr.message,
        status: (deleteErr as { status?: number }).status,
        code: (deleteErr as { code?: string }).code,
        error: deleteErr,
      })
      return {
        error:
          'We could not delete your account right now. Please try again, or email privacy@theblacqlist.com.',
      }
    }
  } catch {
    return {
      error: 'Something went wrong. Please try again, or email privacy@theblacqlist.com.',
    }
  }

  // 4) Best-effort storage cleanup + session clear — never blocks the redirect.
  //    'receipt-uploads' is the only receipt bucket that has ever existed; the
  //    old 'receipts' name was a write path pointing at nothing. The avatar
  //    bucket may not exist yet.
  try {
    if (receiptPaths.length > 0) {
      await service.storage.from('receipt-uploads').remove(receiptPaths)
    }
    if (avatarPath) {
      await service.storage.from('avatars').remove([avatarPath])
    }
    if (verificationDocPaths.length > 0) {
      // New documents live in 'verification-docs'; ones submitted before the
      // upload consolidation live in 'receipt-uploads' (see the bucket note in
      // app/admin/verification/[id]/page.tsx). Paths are uuid-named per upload
      // and never collide across buckets, so removing every collected path
      // from both catches the legacy objects too — remove() of a path that
      // isn't in a bucket is a no-op.
      await service.storage.from('verification-docs').remove(verificationDocPaths)
      await service.storage.from('receipt-uploads').remove(verificationDocPaths)
    }
    // The listing/claim rows outlive the user (SET NULL), so clear their
    // pointers — a surviving row must not keep referencing objects that no
    // longer exist, and the admin verification view reads these columns.
    if (listingDocIds.length > 0) {
      await service.from('listings').update({ verification_docs: null }).in('id', listingDocIds)
    }
    if (claimDocIds.length > 0) {
      await service
        .from('claims')
        .update({ verification_doc_paths: null })
        .in('id', claimDocIds)
    }
    await supabase.auth.signOut()
  } catch {
    // PII rows are already deleted above; storage/sign-out cleanup is non-blocking.
  }

  redirect('/sign-in?deleted=1')
}
