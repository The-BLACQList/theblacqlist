// The reminder five days before a tester's free month on a bigger plan ends
// (ticket 136). Runs in the daily expiry cron.
//
// [Decision — founder, 2026-10-20] One email, around day 25: "Your free
// Growth month ends on [date]. You'll go back to Starter at $19/month.
// Nothing to do if that's what you want." Stripe's own trial_will_end fires
// three days out, which is later than the founder wanted, so we send our own.
//
// At most once per enrollment. The sent-at stamp is a compare-and-set taken
// before the send, so two overlapping runs can't both send. The trade: a send
// that fails after the stamp is not retried. A missed reminder is better than
// a doubled one, and the card on the upgrade page says the same thing.
//
// Stripe is the truth for the dates and for whether to send at all. A tester
// who asked to end the plan when the month ends is not reminded that it goes
// back to Starter.

import type { SupabaseClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/resend'
import {
  FreeMonthEndingEmail,
  freeMonthEndingSubject,
} from '@/lib/email/templates/free-month-ending'
import { getPlanMeta } from '@/lib/stripe/plans'
import {
  formatFreeMonthEnd,
  isMarked,
  recordFreeMonthEnd,
  upgradeStatus,
  type StripeLike,
} from '@/lib/tour/upgrade'

/** How long before the month ends the reminder goes out. */
export const REMINDER_LEAD_DAYS = 5

const BATCH = 200

export interface FreeMonthReminderResult {
  backfilled: number
  sent: number
  skipped: number
  failed: number
}

interface DueRow {
  id: string
  tester_user_id: string
  stripe_subscription_schedule_id: string
}

export async function sendFreeMonthReminders(
  service: SupabaseClient,
  stripe: StripeLike,
  now: Date
): Promise<FreeMonthReminderResult> {
  const result: FreeMonthReminderResult = { backfilled: 0, sent: 0, skipped: 0, failed: 0 }
  const nowSec = Math.floor(now.getTime() / 1000)

  // 1. Claims whose end date never got written (that write is best effort in
  //    the claim route). Without it the row would never come due.
  const { data: missing, error: missingError } = await service
    .from('tour_enrollments')
    .select('id, stripe_subscription_schedule_id')
    .not('stripe_subscription_schedule_id', 'is', null)
    .is('upgrade_trial_ends_at', null)
    .is('upgrade_reminder_sent_at', null)
    .limit(BATCH)
  if (missingError) throw new Error(`free-month backfill read failed: ${missingError.message}`)
  for (const row of (missing ?? []) as { id: string; stripe_subscription_schedule_id: string }[]) {
    try {
      const schedule = await stripe.subscriptionSchedules.retrieve(
        row.stripe_subscription_schedule_id
      )
      if (isMarked(schedule) && (await recordFreeMonthEnd(service, row.id, schedule)) !== null) {
        result.backfilled++
      }
    } catch (err) {
      result.failed++
      logFailure('backfill', row.id, err)
    }
  }

  // 2. Months ending within the lead window that haven't been reminded.
  const until = new Date(now.getTime() + REMINDER_LEAD_DAYS * 24 * 60 * 60 * 1000)
  const { data: due, error: dueError } = await service
    .from('tour_enrollments')
    .select('id, tester_user_id, stripe_subscription_schedule_id')
    .not('stripe_subscription_schedule_id', 'is', null)
    .is('upgrade_reminder_sent_at', null)
    .gt('upgrade_trial_ends_at', now.toISOString())
    .lte('upgrade_trial_ends_at', until.toISOString())
    .order('upgrade_trial_ends_at')
    .limit(BATCH)
  if (dueError) throw new Error(`free-month reminder read failed: ${dueError.message}`)

  for (const row of (due ?? []) as DueRow[]) {
    try {
      const schedule = await stripe.subscriptionSchedules.retrieve(
        row.stripe_subscription_schedule_id
      )
      const status = upgradeStatus(schedule, nowSec)
      if (
        !isMarked(schedule) ||
        !status.running ||
        status.cancelling ||
        status.endsAt === null ||
        !status.tier ||
        !status.returnTier
      ) {
        result.skipped++
        continue
      }

      const { data: stamped, error: stampError } = await service
        .from('tour_enrollments')
        .update({ upgrade_reminder_sent_at: now.toISOString() })
        .eq('id', row.id)
        .is('upgrade_reminder_sent_at', null)
        .select('id')
      if (stampError) throw new Error(stampError.message)
      if ((stamped ?? []).length === 0) {
        result.skipped++
        continue
      }

      const { data: user } = await service.auth.admin.getUserById(row.tester_user_id)
      const email = user?.user?.email
      if (!email) {
        result.failed++
        logFailure('no-email', row.id, null)
        continue
      }

      const tierName = getPlanMeta(status.tier).name
      const back = getPlanMeta(status.returnTier)
      await sendEmail({
        to: email,
        subject: freeMonthEndingSubject(tierName),
        react: FreeMonthEndingEmail({
          tierName,
          returnTierName: back.name,
          returnPrice: back.price_monthly,
          endsOn: formatFreeMonthEnd(status.endsAt),
        }),
      })
      result.sent++
    } catch (err) {
      result.failed++
      logFailure('send', row.id, err)
    }
  }

  return result
}

function logFailure(step: string, enrollmentId: string, err: unknown): void {
  console.error(
    JSON.stringify({
      level: 'error',
      op: 'tour.upgrade.reminder',
      step,
      enrollmentId,
      message: err instanceof Error ? err.message : err === null ? null : String(err),
    })
  )
}
