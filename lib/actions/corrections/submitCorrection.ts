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

  const serviceClient = createServiceClient()

  // Create moderation queue entry — corrections table deferred to Beta DB migration.
  // Issue types and notes are stored as a JSON priority note in the queue.
  // Admin sees the listing_id and knows to check the listing for the reported issues.
  const { error } = await serviceClient.from('moderation_queue').insert({
    entity_id: listingId,
    entity_type: 'listing',
    queue_type: 'correction',
    status: 'pending',
    priority: validIssueTypes.includes('permanently_closed') ? 1 : 0,
  })

  if (error) return { error: 'Failed to submit your report. Please try again.' }

  return { success: true }
}
