'use server'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { CORRECTION_ISSUE_TYPES, type CorrectionIssueType } from '@/lib/constants/corrections'

export type SubmitCorrectionState = { success: true } | { error: string } | null

export async function submitCorrectionAction(
  _prev: SubmitCorrectionState,
  formData: FormData
): Promise<SubmitCorrectionState> {
  const supabase = await createClient()

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

  // Attribution is best-effort and deliberately optional: corrections are
  // accepted from signed-out visitors, so a missing user is a supported case,
  // not a failure. Read from the request-scoped client, never from form data —
  // a client-supplied user id would let anyone attribute a report to someone
  // else.
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
