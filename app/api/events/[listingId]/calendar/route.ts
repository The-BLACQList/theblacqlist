import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { buildEntityUrl } from '@/lib/listings/url'
import { buildEventIcs } from '@/lib/calendar/ics'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ listingId: string }> }
) {
  const { listingId } = await params
  if (!listingId) return new Response('Not found', { status: 404 })

  const supabase = await createClient()

  // RLS only exposes published listings/event details to anon.
  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, slug, status, entity_type, cities(slug)')
    .eq('id', listingId)
    .eq('status', 'published')
    .eq('entity_type', 'event')
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) return new Response('Not found', { status: 404 })

  const sb = supabase as unknown as SupabaseClient
  const { data: ev } = await sb
    .from('listing_details_event')
    .select('starts_at, ends_at, description, venue_name, venue_address, city_text, state, is_online')
    .eq('listing_id', listingId)
    .maybeSingle()

  const event = ev as {
    starts_at: string
    ends_at: string | null
    description: string | null
    venue_name: string | null
    venue_address: string | null
    city_text: string | null
    state: string | null
    is_online: boolean
  } | null

  if (!event?.starts_at) return new Response('Not found', { status: 404 })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://theblacqlist.com'
  const citySlug = (listing.cities as { slug: string } | null)?.slug
  const eventUrl = `${siteUrl}${buildEntityUrl('event', citySlug, listing.slug)}`

  const location = event.is_online
    ? 'Online'
    : [event.venue_name, event.venue_address, [event.city_text, event.state].filter(Boolean).join(', ')]
        .filter(Boolean)
        .join(', ') || null

  const ics = buildEventIcs({
    uid: `event-${listing.id}@theblacqlist.com`,
    title: listing.name,
    start: event.starts_at,
    end: event.ends_at,
    description: event.description,
    location,
    url: eventUrl,
  })

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${listing.slug || 'event'}.ics"`,
      'Cache-Control': 'public, max-age=600',
    },
  })
}
