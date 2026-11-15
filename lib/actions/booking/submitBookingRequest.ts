'use server'

import { headers } from 'next/headers'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getAppUrl, isFeatureEnabled } from '@/lib/env'
import { canAccess } from '@/lib/stripe/features'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { TURNSTILE_ERROR, verifyTurnstileFormData } from '@/lib/security/turnstile'
import { isHoneypotTripped } from '@/lib/security/honeypot'
import { sendEmail } from '@/lib/email/resend'
import {
  BookingRequestOwnerEmail,
  BookingRequestSentEmail,
} from '@/lib/email/templates/booking-request'
import {
  BOOKING_EMAIL_LIMIT,
  BOOKING_IP_LIMIT,
  BOOKING_UNAVAILABLE,
  isUuid,
  parseBookingRequest,
  toBookingSettings,
  whenLabel,
  type BookingFieldErrors,
} from '@/lib/listings/booking'

export type BookingRequestState =
  | { success: true }
  | { error: string; fieldErrors?: BookingFieldErrors }
  | null

const TRY_AGAIN = 'We couldn’t send your request. Please try again.'

/**
 * A visitor asks to book with a business (ticket 109). Request-and-confirm:
 * nothing is booked until the owner answers from their dashboard.
 *
 * Order: flag → honeypot (silent success) → Turnstile → IP limit → the form →
 * per-email limit → the page (published, a business, Premium, requests on) →
 * the service belongs to the page → insert with the service client (the table
 * has no INSERT policy) → email the owner (Reply-To the visitor) and the
 * visitor. Signed in or not; a signed-in visitor's request is linked to them
 * so it can show in their account later. The owner can't request their own
 * page. Nothing the visitor typed goes to analytics or logs.
 */
export async function submitBookingRequestAction(
  _prev: BookingRequestState,
  formData: FormData
): Promise<BookingRequestState> {
  if (!isFeatureEnabled('bookingRequests')) return { error: BOOKING_UNAVAILABLE }

  // A bot filled the hidden field: look like it worked, write nothing.
  if (isHoneypotTripped(formData)) return { success: true }

  if (!(await verifyTurnstileFormData(formData))) return { error: TURNSTILE_ERROR }

  const ip = getClientIp(await headers())
  if (
    !(await checkRateLimit({
      bucket: 'booking_request',
      identifier: `ip:${ip}`,
      ...BOOKING_IP_LIMIT,
    }))
  ) {
    return { error: 'You’ve sent a lot of requests. Try again in an hour.' }
  }

  const listingId = formData.get('listing_id')?.toString().trim() ?? ''
  if (!isUuid(listingId)) return { error: BOOKING_UNAVAILABLE }

  const parsed = parseBookingRequest(
    {
      name: formData.get('name'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      serviceId: formData.get('service_id'),
      requestedDate: formData.get('requested_date'),
      timeWindow: formData.get('time_window'),
      partySize: formData.get('party_size'),
      note: formData.get('message'),
    },
    new Date()
  )
  if (!parsed.ok) {
    return { error: 'Check the highlighted fields.', fieldErrors: parsed.fieldErrors }
  }
  const request = parsed.value

  if (
    !(await checkRateLimit({
      bucket: 'booking_request',
      identifier: `email:${request.requester_email}`,
      ...BOOKING_EMAIL_LIMIT,
    }))
  ) {
    return { error: 'That email address has sent a lot of requests today. Try again tomorrow.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const service = createServiceClient()
  const { data: listing } = await service
    .from('listings')
    .select('id, name, slug, status, deleted_at, entity_type, tier, owner_user_id')
    .eq('id', listingId)
    .maybeSingle()
  if (
    !listing ||
    listing.deleted_at ||
    listing.status !== 'published' ||
    !listing.owner_user_id ||
    listing.entity_type === 'job' ||
    listing.entity_type === 'event' ||
    !canAccess(listing.tier, 'booking_requests')
  ) {
    return { error: BOOKING_UNAVAILABLE }
  }
  if (user && user.id === listing.owner_user_id) {
    return { error: 'You can’t send a request to your own page.' }
  }

  const { data: settingsRow, error: settingsError } = await service
    .from('listing_booking_settings')
    .select('enabled, prompt, ask_date, ask_party_size')
    .eq('listing_id', listing.id)
    .maybeSingle()
  if (settingsError) return { error: TRY_AGAIN }
  const settings = toBookingSettings(settingsRow)
  if (!settings.enabled) return { error: BOOKING_UNAVAILABLE }

  // A field the owner turned off is dropped, whatever the browser sent.
  if (!settings.ask_date) request.requested_date = null
  if (!settings.ask_party_size) request.party_size = null

  let serviceName: string | null = null
  if (request.service_id) {
    const { data: svc } = await service
      .from('services')
      .select('id, name')
      .eq('id', request.service_id)
      .eq('listing_id', listing.id)
      .maybeSingle()
    if (!svc) request.service_id = null
    else serviceName = svc.name
  }

  const { error: insertError } = await service.from('booking_requests').insert({
    listing_id: listing.id,
    requester_user_id: user?.id ?? null,
    ...request,
  })
  if (insertError) return { error: TRY_AGAIN }

  const summary = {
    when: whenLabel(request.requested_date, request.time_window),
    service: serviceName,
    partySize: request.party_size,
    note: request.note,
  }
  const siteUrl = getAppUrl()

  // Emails never fail the request: it is saved, and the owner sees it on
  // their dashboard either way. sendEmail never throws.
  let ownerEmail: string | null = null
  try {
    const { data } = await service.auth.admin.getUserById(listing.owner_user_id)
    ownerEmail = data?.user?.email ?? null
  } catch {
    ownerEmail = null
  }
  await Promise.all([
    ownerEmail
      ? sendEmail({
          to: ownerEmail,
          subject: `New Booking Request for ${listing.name}`,
          replyTo: request.requester_email,
          react: BookingRequestOwnerEmail({
            businessName: listing.name,
            requesterName: request.requester_name,
            requesterEmail: request.requester_email,
            requesterPhone: request.requester_phone,
            summary,
            inboxUrl: `${siteUrl}/dashboard/pages/${listing.id}/bookings`,
            siteUrl,
          }),
        })
      : Promise.resolve(),
    sendEmail({
      to: request.requester_email,
      subject: `Your Request to ${listing.name}`,
      react: BookingRequestSentEmail({ businessName: listing.name, summary, siteUrl }),
    }),
  ])

  return { success: true }
}
