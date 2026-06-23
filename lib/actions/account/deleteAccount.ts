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
 * Two things the bare cascade does NOT cover, handled explicitly here:
 *   1. Reviews (reviewer_user_id is SET NULL) — the spec says *remove* the user's
 *      reviews, so we delete them before deleting the auth user.
 *   2. Storage objects do not cascade — receipt images and the avatar are removed
 *      best-effort (the PII rows are already gone, so a storage hiccup must not
 *      block or fail the deletion the user asked for).
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

    // 2) Reviews are SET NULL on user delete (anonymize) — but the data-handling
    //    spec says remove the user's reviews. Do it explicitly.
    await service.from('reviews').delete().eq('reviewer_user_id', userId)

    // 3) Delete the auth user. FK cascades/SET NULLs handle the relational cleanup.
    const { error: deleteErr } = await service.auth.admin.deleteUser(userId)
    if (deleteErr) {
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
  //    Receipt bucket naming is inconsistent in older code paths ('receipts' vs
  //    'receipt-uploads'), so clear from both; the avatar bucket may not exist yet.
  try {
    if (receiptPaths.length > 0) {
      await service.storage.from('receipts').remove(receiptPaths)
      await service.storage.from('receipt-uploads').remove(receiptPaths)
    }
    if (avatarPath) {
      await service.storage.from('avatars').remove([avatarPath])
    }
    await supabase.auth.signOut()
  } catch {
    // PII rows are already deleted above; storage/sign-out cleanup is non-blocking.
  }

  redirect('/sign-in?deleted=1')
}
