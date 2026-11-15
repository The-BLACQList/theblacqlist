'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOwnerSession } from '@/lib/dashboard/guard'
import { getAppUrl, isFeatureEnabled } from '@/lib/env'
import { canAccess } from '@/lib/stripe/features'
import { buildEntityUrl } from '@/lib/listings/url'
import { revalidateOwnerEditors } from '@/lib/dashboard/revalidateEditors'
import { sendEmail } from '@/lib/email/resend'
import { BookingReplyEmail, type BookingReplyStatus } from '@/lib/email/templates/booking-request'
import {
  BOOKING_REQUEST_COLUMNS,
  DECISION_STATUS,
  canRespond,
  isUuid,
  parseBookingReply,
  parseBookingSettings,
  toBookingSettings,
  toOwnerBookings,
  whenLabel,
  type BookingSettings,
  type OwnerBookingRequest,
} from '@/lib/listings/booking'

// Booking requests, the owner's side (ticket 109). Both actions run on the
// owner's own client, so the RLS policies apply as well as the checks here;
// the table only lets the owner change the answer columns.
//
// Turning requests ON needs Premium and the bookingRequests flag. Turning them
// off and editing the wording are always allowed. Answering a request emails
// the visitor, so it also needs the flag (GATE-COMMS), but not the plan: an
// owner who moved down a plan can still answer what already came in.
//
// The answer goes from noreply with no Reply-To: the owner's sign-in email
// may be personal, and the visitor reaches the business through its page.

export type BookingSettingsState = { success: true; settings: BookingSettings } | { error: string }
export type BookingReplyState = { success: true; request: OwnerBookingRequest } | { error: string }

const NOT_FOUND = 'Page not found, or you can’t edit it.'
const NOT_OPEN = 'Booking requests aren’t open yet.'
const TRY_AGAIN = 'We couldn’t save that. Please try again.'

type Supabase = Awaited<ReturnType<typeof createClient>>

interface OwnedListing {
  id: string
  name: string
  slug: string
  status: string | null
  entity_type: string
  tier: string | null
  cities: unknown
}

async function ownedListing(
  listingId: unknown
): Promise<{ ok: false; error: string } | { ok: true; supabase: Supabase; listing: OwnedListing }> {
  const owner = await getOwnerSession()
  if (!owner) return { ok: false, error: 'Please sign in again.' }
  if (!isUuid(listingId)) return { ok: false, error: NOT_FOUND }

  const supabase = await createClient()
  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, slug, status, entity_type, tier, cities(slug)')
    .eq('id', listingId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!listing) return { ok: false, error: NOT_FOUND }
  if (listing.entity_type === 'job' || listing.entity_type === 'event') {
    return { ok: false, error: NOT_FOUND }
  }
  return { ok: true, supabase, listing: listing as OwnedListing }
}

function pageUrl(listing: OwnedListing): string {
  const citySlug = (listing.cities as { slug: string } | null)?.slug
  return buildEntityUrl(listing.entity_type, citySlug, listing.slug)
}

function revalidate(listing: OwnedListing): void {
  if (listing.status === 'published' && listing.slug) revalidatePath(pageUrl(listing))
  revalidatePath(`/dashboard/pages/${listing.id}/bookings`)
  revalidateOwnerEditors(listing.id)
}

/** Switches the form on or off and sets its wording. */
export async function saveBookingSettingsAction(input: {
  listingId: unknown
  enabled: unknown
  prompt: unknown
  askDate: unknown
  askPartySize: unknown
}): Promise<BookingSettingsState> {
  const owned = await ownedListing(input?.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const parsed = parseBookingSettings(input)
  if (!parsed.ok) return { error: parsed.error }
  const settings = parsed.value

  if (settings.enabled) {
    if (!isFeatureEnabled('bookingRequests')) return { error: NOT_OPEN }
    if (!canAccess(listing.tier, 'booking_requests')) {
      return { error: 'Booking requests come with Premium.' }
    }
  }

  const { data, error } = await supabase
    .from('listing_booking_settings')
    .upsert(
      { listing_id: listing.id, ...settings, updated_at: new Date().toISOString() },
      { onConflict: 'listing_id' }
    )
    .select('enabled, prompt, ask_date, ask_party_size')
    .single()
  if (error || !data) return { error: TRY_AGAIN }

  revalidate(listing)
  return { success: true, settings: toBookingSettings(data) }
}

/** Accepts, declines or suggests another time, and emails the visitor. */
export async function respondToBookingAction(input: {
  listingId: unknown
  id: unknown
  decision: unknown
  reply: unknown
}): Promise<BookingReplyState> {
  if (!isFeatureEnabled('bookingRequests')) return { error: NOT_OPEN }
  if (!isUuid(input?.id)) return { error: 'Request not found.' }
  const owned = await ownedListing(input.listingId)
  if (!owned.ok) return { error: owned.error }
  const { supabase, listing } = owned

  const parsed = parseBookingReply(input.decision, input.reply)
  if (!parsed.ok) return { error: parsed.error }

  const { data: row } = await supabase
    .from('booking_requests')
    .select(BOOKING_REQUEST_COLUMNS)
    .eq('id', input.id)
    .eq('listing_id', listing.id)
    .maybeSingle()
  const current = toOwnerBookings(row ? [row] : [])[0]
  if (!current) return { error: 'Request not found.' }
  if (!canRespond(current.status)) {
    return { error: 'You’ve already answered this request.' }
  }

  const status = DECISION_STATUS[parsed.decision]
  const now = new Date().toISOString()
  // .eq('status', current.status): if another tab answered first, nothing
  // matches and the visitor doesn't get two emails.
  const { data: updated, error } = await supabase
    .from('booking_requests')
    .update({ status, owner_reply: parsed.reply, responded_at: now, updated_at: now })
    .eq('id', current.id)
    .eq('listing_id', listing.id)
    .eq('status', current.status)
    .select(BOOKING_REQUEST_COLUMNS)
    .maybeSingle()
  if (error) return { error: TRY_AGAIN }
  const saved = toOwnerBookings(updated ? [updated] : [])[0]
  if (!saved) return { error: 'This request changed in another tab. Reload the page.' }

  let serviceName: string | null = null
  if (saved.service_id) {
    const { data: svc } = await createServiceClient()
      .from('services')
      .select('name')
      .eq('id', saved.service_id)
      .eq('listing_id', listing.id)
      .maybeSingle()
    serviceName = svc?.name ?? null
  }

  const siteUrl = getAppUrl()
  await sendEmail({
    to: saved.requester_email,
    subject:
      status === 'accepted'
        ? `${listing.name} Accepted Your Request`
        : status === 'declined'
          ? `An Update on Your Request to ${listing.name}`
          : `${listing.name} Suggested Another Time`,
    react: BookingReplyEmail({
      businessName: listing.name,
      status: status as BookingReplyStatus,
      reply: saved.owner_reply,
      summary: {
        when: whenLabel(saved.requested_date, saved.time_window),
        service: serviceName,
        partySize: saved.party_size,
        note: saved.note,
      },
      pageUrl: `${siteUrl}${pageUrl(listing)}`,
      siteUrl,
    }),
  })

  revalidatePath(`/dashboard/pages/${listing.id}/bookings`)
  return { success: true, request: saved }
}
