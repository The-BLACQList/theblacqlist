// GET /api/places/nearest?lat=&lng=  (ticket 230)
//
// "Use my location" in onboarding. The browser rounds the position to 2
// decimals (about a kilometre) before sending it; this answers the closest US
// place: { data: { place: { geoid, label } | null } }.
//
// The coordinates are used for this one lookup. They are never logged, never
// stored and never sent anywhere else, and the answer is never cached.

import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { nearestPlace } from '@/lib/geo/placeQueries'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createClient } from '@/lib/supabase/server'

/** Per IP, per minute. One tap, one call. */
const PER_IP_LIMIT = 20

// A plain string first: z.coerce.number() alone would read an empty `lat=` as 0.
const coord = (min: number, max: number) =>
  z
    .string()
    .trim()
    .regex(/^-?\d{1,3}(\.\d+)?$/, 'Must be a number.')
    .transform(Number)
    .refine((v) => v >= min && v <= max, `Must be between ${min} and ${max}.`)
    // Anything finer than 2 decimals is more than this needs; round it off
    // here too, in case a caller skipped the browser rounding.
    .transform((v) => Math.round(v * 100) / 100)

const querySchema = z.object({
  lat: coord(-90, 90),
  lng: coord(-180, 180),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url)
  const parsed = querySchema.safeParse({
    lat: searchParams.get('lat') ?? '',
    lng: searchParams.get('lng') ?? '',
  })
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
    bucket: 'place_nearest',
    identifier: getClientIp(req.headers),
    limit: PER_IP_LIMIT,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests.', code: 'RATE_LIMITED' }, { status: 429 })
  }

  let place = null
  try {
    const supabase = (await createClient()) as unknown as SupabaseClient
    place = (await nearestPlace(supabase, parsed.data.lat, parsed.data.lng)).place
  } catch {
    // No place is an answer the field already handles: "Type your city instead".
  }

  return NextResponse.json({ data: { place } }, { headers: { 'Cache-Control': 'no-store' } })
}
