import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Shared CRON_SECRET check for the scheduled routes under app/api/cron.
 *
 * ── Auth fails closed ───────────────────────────────────────────────────────
 * These endpoints run on the service role and change what the public sees. An
 * unset `CRON_SECRET` therefore means "refuse", never "allow", the same posture
 * as `isFeatureEnabled()` defaulting off in production. A misconfigured deploy
 * leaves the job un-run, which is safe; the alternative is a public URL that
 * writes to the database.
 *
 * 503 rather than 401 for the unset case, because those are different problems:
 * one is a caller without the secret, the other is a deploy missing an env var.
 * Collapsing them would make the second invisible in the cron logs.
 *
 * Returns a response to send when the caller is refused, or null to go ahead.
 */
export function refuseUnauthorizedCron(request: NextRequest, name: string): NextResponse | null {
  const expected = process.env.CRON_SECRET?.trim()

  if (!expected) {
    console.error(`[cron/${name}] CRON_SECRET is not set — refusing to run.`)
    return NextResponse.json(
      { error: 'Cron is not configured.', code: 'CRON_NOT_CONFIGURED' },
      { status: 503 }
    )
  }

  const provided = request.headers.get('authorization')
  if (!provided || !secretMatches(provided, `Bearer ${expected}`)) {
    return NextResponse.json({ error: 'Unauthorized.', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  return null
}

/** Constant-time compare that does not throw on a length mismatch. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
