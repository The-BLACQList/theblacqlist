'use server'

import { headers } from 'next/headers'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { CORRECTION_ISSUE_TYPES, type CorrectionIssueType } from '@/lib/constants/corrections'
import { isHoneypotTripped } from '@/lib/security/honeypot'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { TURNSTILE_ERROR, verifyTurnstileFormData } from '@/lib/security/turnstile'

export type SubmitCorrectionState = { success: true } | { error: string } | null

// This is the one public write that needs no account, and it lands in the admin
// moderation queue with the service-role client, so it carries every anonymous
// guard we have: honeypot, Turnstile, and a per-person limit.
const RATE_LIMIT = 5
const RATE_WINDOW_SECONDS = 10 * 60

export async function submitCorrectionAction(
  _prev: SubmitCorrectionState,
  formData: FormData
): Promise<SubmitCorrectionState> {
  // A bot that filled the hidden field gets the normal success screen and
  // nothing is written.
  if (isHoneypotTripped(formData)) return { success: true }

  if (!(await verifyTurnstileFormData(formData))) {
    return { error: TURNSTILE_ERROR }
  }

  const supabase = await createClient()

  // Attribution is best-effort and deliberately optional: corrections are
  // accepted from signed-out visitors, so a missing user is a supported case,
  // not a failure. Read from the request-scoped client, never from form data —
  // a client-supplied user id would let anyone attribute a report to someone
  // else.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Signed-in people are limited per account, signed-out visitors per IP.
  // Charged before validation so malformed submissions still spend budget.
  const allowed = await checkRateLimit({
    bucket: 'correction',
    identifier: user ? `user:${user.id}` : `ip:${getClientIp(await headers())}`,
    limit: RATE_LIMIT,
    windowSeconds: RATE_WINDOW_SECONDS,
  })
  if (!allowed) {
    return { error: 'You have sent a few reports already. Give it a few minutes and try again.' }
  }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  const issueTypes = formData.getAll('issue_type').map((v) => v.toString())
  const notes = formData.get('notes')?.toString().trim() || null

  if (!listingId) return { error: 'Missing listing ID.' }
  if (issueTypes.length === 0) return { error: 'Please select at least one issue.' }
  if (notes && notes.length > 500) return { error: 'Notes must be 500 characters or fewer.' }

  const validIssueTypes = issueTypes.filter((t): t is CorrectionIssueType =>
    CORRECTION_ISSUE_TYPES.includes(t as CorrectionIssueType)
  )
  if (validIssueTypes.length === 0) return { error: 'Invalid issue type selected.' }

  // Verify listing exists and is published
  const { data: listing } = await supabase
    .from('listings')
    .select('id')
    .eq('id', listingId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return { error: 'Listing not found.' }

  const serviceClient = createServiceClient()

  // The moderation queue is the corrections store — there is no separate
  // corrections table, and `details` is the queue-type-specific payload added by
  // 20260828000000_moderation_queue_details.sql. Before that migration this
  // insert carried neither the issue types nor the notes and both were silently
  // discarded, leaving an admin with "listing X has a correction" and nothing to
  // act on.
  const { error } = await serviceClient.from('moderation_queue').insert({
    entity_id: listingId,
    entity_type: 'listing',
    queue_type: 'correction',
    status: 'pending',
    priority: validIssueTypes.includes('permanently_closed') ? 1 : 0,
    details: { issue_types: validIssueTypes, notes },
    submitted_by: user?.id ?? null,
  })

  if (error) return { error: 'Failed to submit your report. Please try again.' }

  return { success: true }
}
