// GET /api/places/lookup?q=  (ticket 142)
//
// Answers where on the map the words point: { data: { label, lat, lng, zoom } },
// or { data: null } when they name no place. The map search box calls it on
// Enter only. See lib/search/placeLookup.ts for the order it checks things in.
//
// Never logs the query or the coordinates. A failed upstream answers
// { data: null } with status 200, because a place miss must never get in the
// way of the pin filter the box already ran.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import type { AssistCity } from '@/lib/search/assist'
import { lookupPlace } from '@/lib/search/placeLookup'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createClient } from '@/lib/supabase/server'

/** Per IP, per minute. Enter-only, so a person never gets near it. */
const PER_IP_LIMIT = 30
/** Shared across every caller, per minute: inside Nominatim's 1 request a second. */
const UPSTREAM_LIMIT = 50

const querySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, 'Type at least 2 characters.')
    .max(100, 'Keep it under 100 characters.'),
})

type CityRow = {
  id: string
  name: string
  slug: string
  is_active: boolean
  latitude: number | string | null
  longitude: number | string | null
  states: { code: string } | null
}

async function loadCities(): Promise<AssistCity[]> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('cities')
      .select('id, name, slug, is_active, latitude, longitude, states!cities_state_id_fkey(code)')
    return ((data as unknown as CityRow[] | null) ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      isActive: c.is_active,
      lat: c.latitude == null ? null : Number(c.latitude),
      lng: c.longitude == null ? null : Number(c.longitude),
      stateCode: c.states?.code ?? null,
    }))
  } catch {
    // Without our cities the lookup still has OpenStreetMap.
    return []
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url)
  const parsed = querySchema.safeParse({ q: searchParams.get('q') ?? '' })
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    )
  }

  const allowed = await checkRateLimit({
    bucket: 'place_lookup',
    identifier: getClientIp(req.headers),
    limit: PER_IP_LIMIT,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests.', code: 'RATE_LIMITED' }, { status: 429 })
  }

  const cities = await loadCities()
  const { place, cacheable } = await lookupPlace(parsed.data.q, cities, {
    allowUpstream: () =>
      checkRateLimit({
        bucket: 'place_lookup_upstream',
        identifier: 'nominatim',
        limit: UPSTREAM_LIMIT,
      }),
  })

  return NextResponse.json(
    { data: place },
    {
      headers: {
        // A passing outage is never cached as a miss.
        'Cache-Control': cacheable ? 'public, s-maxage=86400' : 'no-store',
      },
    }
  )
}
