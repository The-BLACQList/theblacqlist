import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { trackServerEvent } from '@/lib/analytics/server'
import { VALID_EVENT_NAMES } from '@/lib/analytics/constants'

const MAX_PROPERTIES_BYTES = 5 * 1024 // 5 KB

// 30 requests per IP per 60-second window.
//
// Was an in-memory Map until 2026-08-16. On Fluid Compute an instance is reused
// across concurrent requests but is still replaced, and concurrent instances do
// not share memory, so the Map bounded nothing under real traffic. The counter
// now lives in Postgres; see lib/security/rate-limit.ts.
const RATE_LIMIT = 30

export async function POST(req: NextRequest): Promise<NextResponse> {
  const allowed = await checkRateLimit({
    bucket: 'analytics_event',
    identifier: getClientIp(req.headers),
    limit: RATE_LIMIT,
  })

  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests.', code: 'RATE_LIMITED' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.', code: 'VALIDATION_ERROR' }, { status: 400 })
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json(
      { error: 'Request body required.', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const { event_name, entity_type, entity_id, properties, session_id } = body as Record<
    string,
    unknown
  >

  // Validate event_name
  if (!event_name || typeof event_name !== 'string' || !VALID_EVENT_NAMES.has(event_name)) {
    return NextResponse.json(
      { error: 'Invalid event_name.', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  // Validate entity_id format if present
  if (entity_id !== undefined && entity_id !== null && typeof entity_id !== 'string') {
    return NextResponse.json(
      { error: 'entity_id must be a string.', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  // Validate properties size
  if (properties !== undefined && properties !== null) {
    const serialized = JSON.stringify(properties)
    if (serialized.length > MAX_PROPERTIES_BYTES) {
      return NextResponse.json(
        { error: 'properties exceeds 5 KB limit.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }
  }

  // Best-effort user_id from session — no session is OK
  let userId: string | null = null
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch {
    // anonymous events are valid
  }

  // This was `void serviceClient.from('analytics_events').insert({...})` until
  // 2026-08-11, which inserted nothing. A PostgREST query builder is lazy — it
  // only issues its request when something calls .then() on it. `void` does not,
  // so the statement built a request object and discarded it. Every client-side
  // event this endpoint has ever accepted was dropped, and it returned 200 each
  // time, so nothing anywhere reported a failure.
  //
  // trackServerEvent awaits the insert inside after(), which both fires it and
  // keeps it off the response path. Same three server actions still carry the
  // original `void` pattern — checkpoint 1.15.
  trackServerEvent({
    event_name,
    entity_id: (entity_id as string | null | undefined) ?? null,
    entity_type: (entity_type as string | null | undefined) ?? null,
    user_id: userId,
    session_id: (session_id as string | null | undefined) ?? null,
    properties: (properties ?? {}) as Record<string, unknown>,
  })

  return NextResponse.json({ data: { success: true } })
}
