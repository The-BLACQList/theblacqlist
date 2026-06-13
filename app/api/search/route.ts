import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchSchema } from '@/lib/validations/search'
import { searchListings } from '@/lib/services/search'

const ANON_LIMIT = 60
const AUTH_LIMIT = 120
const WINDOW_MS = 60_000

const ipHits = new Map<string, { count: number; windowStart: number }>()

function getRateLimitKey(req: NextRequest, userId: string | null): string {
  if (userId) return `user:${userId}`
  const forwarded = req.headers.get('x-forwarded-for') ?? ''
  return (forwarded.split(',')[0] ?? '').trim() || req.headers.get('x-real-ip') || 'unknown'
}

function checkRateLimit(key: string, limit: number): boolean {
  const now = Date.now()
  const entry = ipHits.get(key)
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    ipHits.set(key, { count: 1, windowStart: now })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
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

  const rateKey = getRateLimitKey(req, userId)
  const rateLimit = userId ? AUTH_LIMIT : ANON_LIMIT
  if (!checkRateLimit(rateKey, rateLimit)) {
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
  } catch {
    return NextResponse.json(
      { error: 'Search is temporarily unavailable.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}
