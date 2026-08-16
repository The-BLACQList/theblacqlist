import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit'
import { searchSchema } from '@/lib/validations/search'
import { searchListings, UnknownFilterValueError } from '@/lib/services/search'

const ANON_LIMIT = 60
const AUTH_LIMIT = 120

// Was an in-memory Map until 2026-08-16. On Fluid Compute an instance is reused
// across concurrent requests but is still replaced, and concurrent instances do
// not share memory, so the Map bounded nothing under real traffic. The counter
// now lives in Postgres; see lib/security/rate-limit.ts.
function getRateLimitIdentifier(req: NextRequest, userId: string | null): string {
  if (userId) return `user:${userId}`
  return getClientIp(req.headers)
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url)

  const parsed = searchSchema.safeParse(Object.fromEntries(searchParams))
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

  let userId: string | null = null
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    userId = user?.id ?? null
  } catch {
    // anonymous request
  }

  const allowed = await checkRateLimit({
    bucket: 'search',
    identifier: getRateLimitIdentifier(req, userId),
    limit: userId ? AUTH_LIMIT : ANON_LIMIT,
  })
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests.', code: 'RATE_LIMITED' },
      { status: 429 }
    )
  }

  try {
    const { results, total } = await searchListings(parsed.data)
    return NextResponse.json({
      data: results,
      meta: {
        total,
        page: parsed.data.page,
        limit: parsed.data.limit,
      },
    })
  } catch (err) {
    // A filter slug that doesn't exist is the caller's mistake, not an outage.
    // Answering 200 with the unfiltered index (the old behavior) is worse than
    // any error: it looks like a valid result set.
    if (err instanceof UnknownFilterValueError) {
      return NextResponse.json(
        { error: err.message, code: 'UNKNOWN_FILTER_VALUE', fields: err.fields },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: 'Search is temporarily unavailable.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
