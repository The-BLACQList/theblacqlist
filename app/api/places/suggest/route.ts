// GET /api/places/suggest?q=  (ticket 230)
//
// The onboarding "Your City" typeahead. Answers up to 8 US places from our own
// copy of the Census place list: { data: { places: [{ geoid, label }] } }.
// Nothing leaves our servers, so no outside company sees what people type.
//
// Never logs the query. A database error answers an empty list (status 200,
// not cached), because typing must never break onboarding; Skip still works.

import { NextRequest, NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { suggestPlaces } from '@/lib/geo/placeQueries'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { createClient } from '@/lib/supabase/server'

/** Per IP, per minute. The field asks once per pause in typing, not per key. */
const PER_IP_LIMIT = 60
const MAX_RESULTS = 8

const querySchema = z.object({
  q: z
    .string()
    .trim()
    .min(2, 'Type at least 2 characters.')
    .max(60, 'Keep it under 60 characters.'),
})

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
    bucket: 'place_suggest',
    identifier: getClientIp(req.headers),
    limit: PER_IP_LIMIT,
  })
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests.', code: 'RATE_LIMITED' }, { status: 429 })
  }

  let result: Awaited<ReturnType<typeof suggestPlaces>> = { places: [], ok: false }
  try {
    const supabase = (await createClient()) as unknown as SupabaseClient
    result = await suggestPlaces(supabase, parsed.data.q, MAX_RESULTS)
  } catch {
    // Falls through to the empty, uncached answer.
  }

  return NextResponse.json(
    { data: { places: result.places } },
    { headers: { 'Cache-Control': result.ok ? 'public, s-maxage=86400' : 'no-store' } }
  )
}
