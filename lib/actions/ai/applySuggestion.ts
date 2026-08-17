'use server'

import { revalidatePath } from 'next/cache'
import { findAgent } from '@/lib/ai/agents'
import { loadOwnedSuggestion } from '@/lib/ai/review'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { buildEntityUrl } from '@/lib/listings/url'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export type ApplySuggestionState = { success: true } | { error: string } | null

/**
 * Writes an approved suggestion into the listing field it was generated for.
 *
 * ── The destination comes from the registry, never from the request ───────────
 * The form sends a suggestion ID and nothing else. Which column gets overwritten
 * is looked up from `AI_AGENTS` via the `agent_type` stored on the row at
 * generation time. A form field naming the target table and column would be a
 * request parameter that decides which of the owner's data gets replaced with
 * arbitrary text — and it would be trivially forgeable.
 *
 * ── The field write uses the owner's own client ───────────────────────────────
 * Deliberately not the service client. Updating `listings` is something the owner
 * is allowed to do, so it goes through their session and RLS applies, with the
 * `owner_user_id` filter as the belt to RLS's braces. Only the status stamp on
 * `ai_suggestions` needs the service role, because owners have no UPDATE there.
 * Two clients in one action looks redundant; it means the destructive half of
 * this operation is the half that is still under RLS.
 */
export async function applySuggestionAction(
  _prev: ApplySuggestionState,
  formData: FormData
): Promise<ApplySuggestionState> {
  const owner = await getOwnerSession()
  if (!owner) return { error: 'You must be signed in to apply a suggestion.' }

  const suggestionId = formData.get('suggestion_id')?.toString().trim() ?? ''

  const loaded = await loadOwnedSuggestion(suggestionId, owner.user.id, 'approved')
  if (!loaded.ok) return { error: loaded.error }
  const { id, listingId, agentType, suggestionText } = loaded.suggestion

  const agent = findAgent(agentType)
  if (!agent) return { error: 'This suggestion can no longer be applied automatically.' }
  if (!agent.applyTarget) {
    // Captions and analytics summaries have no field to become. Refusing beats
    // guessing a plausible destination — see the note in lib/ai/agents.ts.
    return { error: 'This suggestion is for you to copy — there is no page field to apply it to.' }
  }

  const supabase = await createClient()
  const target = agent.applyTarget

  if (target.table === 'listings') {
    // Spelled out per column rather than built with `{ [target.column]: ... }`.
    // A computed key widens to a string index signature, which the generated
    // Update type refuses — and rightly: the whole point of the registry is that
    // the destination column is a known literal, and a computed key throws that
    // guarantee away at exactly the line where it matters.
    const patch =
      target.column === 'meta_title'
        ? { meta_title: suggestionText }
        : { meta_description: suggestionText }

    const { data, error } = await supabase
      .from('listings')
      .update(patch)
      .eq('id', listingId)
      .eq('owner_user_id', owner.user.id)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle()

    if (error || !data) return { error: 'Could not update your page. Please try again.' }
  } else {
    // The details row is created with the listing, so a missing one means
    // something is wrong with the record rather than with this request. Reporting
    // it as a failure is right: an `update` matching zero rows would otherwise
    // return success and change nothing.
    const { data, error } = await supabase
      .from('listing_details_business')
      .update({ description: suggestionText })
      .eq('listing_id', listingId)
      .select('listing_id')
      .maybeSingle()

    if (error || !data) return { error: 'Could not update your page. Please try again.' }
  }

  const service = createServiceClient()
  const { error: stampError } = await service
    .from('ai_suggestions')
    .update({ status: 'applied', applied_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'approved')

  // The field write already succeeded. Failing the whole action here would tell
  // the owner nothing happened when their page has in fact changed, so the write
  // is reported as the success it was and the row stays `approved` — which reads
  // as "approved but we can't prove it was applied", the accurate statement.
  if (stampError) {
    revalidatePath(`/dashboard/pages/${listingId}/ai-suggestions`)
    return { success: true }
  }

  const { data: listing } = await supabase
    .from('listings')
    .select('slug, status, entity_type, cities(slug)')
    .eq('id', listingId)
    .maybeSingle()

  if (listing?.status === 'published') {
    const citySlug = (listing.cities as { slug: string } | null)?.slug
    if (citySlug && listing.slug) {
      revalidatePath(buildEntityUrl(listing.entity_type, citySlug, listing.slug))
    }
  }
  revalidatePath(`/dashboard/pages/${listingId}/ai-suggestions`)
  revalidatePath(`/dashboard/pages/${listingId}/edit`)

  return { success: true }
}
