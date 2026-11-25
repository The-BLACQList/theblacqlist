'use server'

// Copies the date this member first saw the site tour to their account, so it
// doesn't open again on another device and Take the Tour ends 30 days after
// the first visit everywhere (ticket 280). Nothing else about the tour is
// stored on our side. Best-effort: a failure only means one more offer.

import { createClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { SITE_TOUR_SEEN_METADATA, earliest } from '@/lib/site-tour/state'

export async function markSiteTourSeenAction(seenAt: unknown): Promise<void> {
  if (!isFeatureEnabled('siteTour')) return
  if (typeof seenAt !== 'string' || seenAt.length > 40) return
  const time = Date.parse(seenAt)
  // A device clock can be wrong; a date still to come would stretch the 30 days.
  if (Number.isNaN(time)) return
  const clean = new Date(Math.min(time, Date.now())).toISOString()
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const saved = user.user_metadata?.[SITE_TOUR_SEEN_METADATA] as string | undefined
    const first = earliest(saved, clean)
    if (!first || first === saved) return
    await supabase.auth.updateUser({ data: { [SITE_TOUR_SEEN_METADATA]: first } })
  } catch {
    // see above
  }
}
