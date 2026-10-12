'use server'

// Close the finished Tester Tour panel for good (founder, 2026-10-12).
//
// Takes no input on purpose: the enrollment comes from the signed-in viewer,
// so a tester can only ever close their own panel. The write is service-role
// because tour_enrollments is SELECT-only under RLS (a tester who could UPDATE
// it could stamp their own completion). The update is scoped to that one row,
// and only once the walk is finished, matching the DB CHECK.
//
// Closing does not end the enrollment, so the free month on the Upgrade page
// is untouched.

import { createServiceClient } from '@/lib/supabase/server'
import { resolveTourViewer } from '@/lib/tour/witness'

export type CloseTourRailResult = { ok: true } | { ok: false; error: string }

const FAILED = 'Couldn’t close the tour just now. Try again in a moment.'

export async function closeTourRailAction(): Promise<CloseTourRailResult> {
  const viewer = await resolveTourViewer()
  if (!viewer) return { ok: false, error: 'The tour isn’t available for this account.' }
  if (viewer.enrollment.completedAt === null) {
    return { ok: false, error: 'Finish the walk first, then you can close the tour.' }
  }
  if (viewer.enrollment.railClosedAt) return { ok: true }

  try {
    const { error } = await createServiceClient()
      .from('tour_enrollments')
      .update({ rail_closed_at: new Date().toISOString() })
      .eq('id', viewer.enrollment.id)
      .eq('tester_user_id', viewer.userId)
      .not('completed_at', 'is', null)
      .is('rail_closed_at', null)
    if (error) return { ok: false, error: FAILED }
    return { ok: true }
  } catch {
    return { ok: false, error: FAILED }
  }
}
