import 'server-only'

// Ticket 284: what the admin page needs to show before a Page is hidden, put
// back or approved. Every read here can fail on its own, and a failed read is
// said out loud: it never looks like "no plan" or "no mark".

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import type { PageHideInfo, PagePlanNotice } from '@/components/admin/PageUnpublishAction'
import { LIVE_STATUSES } from '@/lib/tour/trial'
import { pageHideReasonLabel } from './pageHide'
import { findPageMark, loadPageMarks, type MarkCandidate } from './pageMarks'

type Client = SupabaseClient<Database>

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/New_York',
  })
}

/**
 * Does hiding this Page leave somebody paying? Plans belong to owners (ticket
 * 238), and a hidden Page keeps its place in the plan.
 */
export async function loadPlanNotice(
  client: Client,
  listing: { id: string; tier: string; owner_user_id: string | null }
): Promise<PagePlanNotice> {
  const name = listing.tier === 'free' ? 'paid' : listing.tier
  const plan = `${name.charAt(0).toUpperCase()}${name.slice(1)}`

  const { data: subs, error } = await client
    .from('subscriptions')
    .select('listing_id, user_id')
    .in('status', LIVE_STATUSES)
    .or(
      listing.owner_user_id
        ? `listing_id.eq.${listing.id},user_id.eq.${listing.owner_user_id}`
        : `listing_id.eq.${listing.id}`
    )
  if (error) return { kind: 'unknown' }
  if (subs.length === 0) return { kind: 'none' }
  if (subs.some((s) => s.listing_id === listing.id)) return { kind: 'paid', plan }

  const { data: covered, error: coveredError } = await client
    .from('plan_covered_pages')
    .select('listing_id')
    .eq('listing_id', listing.id)
    .maybeSingle()
  if (coveredError) return { kind: 'unknown' }
  return covered ? { kind: 'paid', plan } : { kind: 'none' }
}

export type PageHide =
  | { kind: 'hidden'; info: PageHideInfo }
  /** Hidden by something else: the event sweep, or before this ticket. */
  | { kind: 'not_ours' }
  | { kind: 'unknown' }

export async function loadPageHide(client: Client, listingId: string): Promise<PageHide> {
  const { data, error } = await client.rpc('admin_page_hide', { p_listing_id: listingId })
  if (error) {
    console.error('[pageVisibility] admin_page_hide failed:', error.message)
    return { kind: 'unknown' }
  }
  const row = data[0]
  if (!row) return { kind: 'not_ours' }
  return {
    kind: 'hidden',
    info: {
      reasonLabel: pageHideReasonLabel(row.reason),
      hiddenOn: dateLabel(row.hidden_at),
      note: row.note,
      marked: row.marked,
    },
  }
}

export type MarkMatch =
  | { kind: 'match'; name: string; cityName: string | null; reason: string; markedOn: string }
  | { kind: 'unknown' }

/** The mark a new Page matches, null for none, or 'unknown' if it can't be read. */
export async function loadMarkMatch(
  client: Client,
  candidate: MarkCandidate
): Promise<MarkMatch | null> {
  try {
    const mark = findPageMark(await loadPageMarks(client), candidate)
    if (!mark) return null
    return {
      kind: 'match',
      name: mark.name,
      cityName: mark.city_name,
      reason: mark.reason,
      markedOn: dateLabel(mark.marked_at),
    }
  } catch (err) {
    console.error('[pageVisibility] marks could not be read:', err)
    return { kind: 'unknown' }
  }
}
