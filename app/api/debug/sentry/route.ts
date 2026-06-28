import { NextResponse, type NextRequest } from 'next/server'

// Guarded test-error trigger for verifying Sentry in production (test K5).
// Disabled unless SENTRY_TEST_TOKEN is set AND the request supplies the matching
// ?token=, so it can't be abused to spam Sentry. When authorized, it throws so
// the error is captured by Sentry with environment=production. Verify in the
// Sentry dashboard that the event appears and contains no PII (see K6).
export async function GET(request: NextRequest) {
  const expected = process.env.SENTRY_TEST_TOKEN
  const provided = request.nextUrl.searchParams.get('token')

  if (!expected || provided !== expected) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  throw new Error('Sentry test error — triggered via /api/debug/sentry')
}
