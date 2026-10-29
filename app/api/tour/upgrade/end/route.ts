import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { stripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'
import { listingIsOwnedBy, resolveTrialClaimer } from '@/lib/tour/freeMonth'
import { isRefusal, setEndOfFreeMonth } from '@/lib/tour/upgrade'

// End the plan when the tester's free month ends, or undo that (ticket 136).
//
// [Decision — founder, 2026-10-20] Cancelling during the free month ends the
// plan after day 30 with no charge. The schedule the claim made carries the
// month; this route only changes what happens when it ends. Nothing here
// touches the 30 days themselves.
//
// The schedule id comes from the caller's own enrollment, never the body, and
// the listing must still be theirs: a page that changed hands keeps its plan.

const bodySchema = z.object({ cancel: z.boolean() }).strict()

const NOT_FOUND = { error: 'Not found.', code: 'NOT_FOUND' } as const
const FAILED = {
  error: 'Couldn’t change your plan just now. Try again in a moment.',
  code: 'END_FREE_MONTH_FAILED',
} as const

export async function POST(request: Request) {
  const viewer = await resolveTrialClaimer()
  if (!viewer || viewer.enrollment.listingId === null) {
    return NextResponse.json(NOT_FOUND, { status: 404 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  try {
    const service = createServiceClient() as unknown as SupabaseClient
    const owned = await listingIsOwnedBy(service, viewer.enrollment.listingId, viewer.userId)
    if (owned === null) return NextResponse.json(FAILED, { status: 500 })
    if (!owned) return NextResponse.json(NOT_FOUND, { status: 404 })

    const { data, error } = await service
      .from('tour_enrollments')
      .select('stripe_subscription_schedule_id')
      .eq('id', viewer.enrollment.id)
      .maybeSingle()
    if (error) return NextResponse.json(FAILED, { status: 500 })
    const scheduleId = (data as { stripe_subscription_schedule_id: string | null } | null)
      ?.stripe_subscription_schedule_id
    if (!scheduleId) return NextResponse.json(NOT_FOUND, { status: 404 })

    const result = await setEndOfFreeMonth(
      stripe,
      scheduleId,
      parsed.data.cancel,
      Math.floor(Date.now() / 1000)
    )
    if (isRefusal(result)) {
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status: result.status }
      )
    }
    return NextResponse.json({
      data: { cancelling: result.cancelling, endsAt: result.endsAt },
    })
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        op: 'tour.upgrade.end',
        enrollmentId: viewer.enrollment.id,
        message: err instanceof Error ? err.message : String(err),
      })
    )
    return NextResponse.json(FAILED, { status: 500 })
  }
}
