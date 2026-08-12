'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { TURNSTILE_ERROR, verifyTurnstileFormData } from '@/lib/security/turnstile'
import { sendEmail } from '@/lib/email/resend'
import { ClaimSubmittedEmail } from '@/lib/email/templates/claim-submitted'
import { ClaimAdminNotificationEmail } from '@/lib/email/templates/claim-admin-notification'

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldErrors = Partial<Record<string, string>>

export type CreateClaimState =
  | { error: string; fieldErrors?: FieldErrors }
  | { success: true; claimId: string }
  | null

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_ROLES = ['owner', 'manager', 'authorized_agent'] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ─── Server Action ────────────────────────────────────────────────────────────

export async function createClaimAction(
  _prev: CreateClaimState,
  formData: FormData
): Promise<CreateClaimState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be signed in to claim a listing.' }
  }

  // CAPTCHA is a layer on top of the 3-per-24h quota below, not a replacement.
  // Runs after auth so an unauthenticated caller never burns a token.
  if (!(await verifyTurnstileFormData(formData))) {
    return { error: TURNSTILE_ERROR }
  }

  // ── Parse fields ────────────────────────────────────────────────────────────
  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const verificationEmail = formData.get('verification_email')?.toString().trim() ?? ''
  const verificationPhone = formData.get('verification_phone')?.toString().trim() || null
  const roleAtBusiness = formData.get('role_at_business')?.toString().trim() ?? ''
  const notes = formData.get('notes')?.toString().trim() || null
  const verificationDocPath = formData.get('verification_doc_path')?.toString().trim() || null

  // ── Validate ────────────────────────────────────────────────────────────────
  const fieldErrors: FieldErrors = {}

  if (!listingId) {
    return { error: 'Invalid listing. Please try again.' }
  }

  if (!verificationEmail) {
    fieldErrors.verification_email = 'Business email address is required.'
  } else if (!isValidEmail(verificationEmail)) {
    fieldErrors.verification_email = 'Enter a valid email address.'
  }

  if (!VALID_ROLES.includes(roleAtBusiness as (typeof VALID_ROLES)[number])) {
    fieldErrors.role_at_business = 'Select your role at this business.'
  }

  if (notes && notes.length > 500) {
    fieldErrors.notes = 'Notes must be 500 characters or fewer.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: 'Please fix the errors below.', fieldErrors }
  }

  // ── Confirm listing exists and is unclaimed ─────────────────────────────────
  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, trust_tier, status')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) {
    return { error: 'Listing not found.' }
  }

  if (listing.trust_tier !== 'unclaimed') {
    return {
      error:
        'This listing has already been claimed. If you believe this is an error, please contact support.',
    }
  }

  if (listing.status !== 'published') {
    return { error: 'This listing is not available for claiming at this time.' }
  }

  // ── Block if user already has an open claim for this listing ────────────────
  const { data: existingClaim } = await supabase
    .from('claims')
    .select('id')
    .eq('listing_id', listingId)
    .eq('claimant_user_id', user.id)
    .in('status', ['pending', 'under_review'])
    .maybeSingle()

  if (existingClaim) {
    return {
      error: 'You already have a pending claim for this listing. View the status in your account.',
    }
  }

  // ── Rate limit: max 3 open claims per user in 24 hours ──────────────────────
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await supabase
    .from('claims')
    .select('id', { count: 'exact', head: true })
    .eq('claimant_user_id', user.id)
    .gte('created_at', since)
    .in('status', ['pending', 'under_review'])

  if ((recentCount ?? 0) >= 3) {
    return {
      error:
        'You have reached the maximum number of claim submissions for the past 24 hours. Please try again later.',
    }
  }

  // ── Insert claim ────────────────────────────────────────────────────────────
  const { data: claim, error: claimError } = await supabase
    .from('claims')
    .insert({
      listing_id: listingId,
      claimant_user_id: user.id,
      status: 'pending',
      verification_email: verificationEmail,
      verification_phone: verificationPhone,
      role_at_business: roleAtBusiness,
      notes,
      verification_doc_paths: verificationDocPath ? [verificationDocPath] : null,
    })
    .select('id')
    .single()

  if (claimError || !claim) {
    return {
      error: 'Something went wrong submitting your claim. Please try again.',
    }
  }

  // ── Moderation queue (service role — queue is admin-only) ───────────────────
  const serviceClient = createServiceClient()

  await serviceClient.from('moderation_queue').insert({
    entity_id: claim.id,
    entity_type: 'claim',
    queue_type: 'claim',
    status: 'pending',
    priority: 0,
  })

  // ── Analytics event (fire-and-forget) ──────────────────────────────────────
  void serviceClient.from('analytics_events').insert({
    event_name: 'claim_submitted',
    entity_id: claim.id,
    entity_type: 'claim',
    user_id: user.id,
    properties: {
      listing_id: listingId,
      has_verification_email: true,
    },
  })

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://theblacqlist.com'

  // ── Confirmation email to claimant (fire-and-forget) ────────────────────────
  if (user.email) {
    void sendEmail({
      to: user.email,
      subject: `Your claim for ${listing.name} is under review`,
      react: ClaimSubmittedEmail({ listingName: listing.name, claimId: claim.id, siteUrl }),
    })
  }

  // ── Admin notification (fire-and-forget) ────────────────────────────────────
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL
  if (adminEmail && user.email) {
    void sendEmail({
      to: adminEmail,
      subject: `New claim submitted: ${listing.name}`,
      react: ClaimAdminNotificationEmail({
        listingName: listing.name,
        claimantEmail: user.email,
        roleAtBusiness,
        claimId: claim.id,
        adminUrl: `${siteUrl}/admin/claims`,
      }),
    })
  }

  return { success: true, claimId: claim.id }
}
