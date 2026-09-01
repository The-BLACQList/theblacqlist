// Tester Tour witnesses: server-side evidence written inside real page renders.
//
// Three of the six steps are proven by the tester simply reaching a page —
// `search_ran`, `listing_opened`, `collection_browsed`. This module records
// those, and ONLY those; the other three steps' rows are created by the
// reflection action after it verifies first-party evidence (saves, reviews,
// moderation_queue). Nothing here or anywhere in the tour reads
// `analytics_events` — that table is client-writable, so a row in it proves a
// browser sent a POST, not that a person did a thing.
//
// Two structural constraints shape the code:
//
//   1. `after()` runs once the response has been sent, where request APIs
//      (`cookies()`, `headers()`) are unavailable in a Server Component. So the
//      viewer is resolved DURING render and only the service-role INSERT is
//      deferred, closing over plain values.
//
//   2. This runs inside public pages that must never get slower or break
//      because the tour exists. Every path is best-effort: the same contract as
//      `trackServerEvent` — resolve, defer, swallow. A thrown error here would
//      take down a page render for every visitor, enrolled or not.
//
// The write is the service role because both tour tables are SELECT-only under
// RLS on purpose (see 20260830000000_tester_tour.sql): a tester who could
// write their own rows could mint a free Starter trial.

import { cache } from 'react'
import { after } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import type { TourStepKey } from '@/lib/tour/steps'

// The steps a page render is allowed to witness. A step outside this list can
// only be completed through the reflection action's evidence checks, and the
// narrower type makes calling `recordTourWitness('listing_saved', …)` a type
// error rather than a quiet forgery vector.
export const WITNESS_STEPS = ['search_ran', 'listing_opened', 'collection_browsed'] as const

export type WitnessStepKey = (typeof WITNESS_STEPS)[number]

export interface TourViewer {
  userId: string
  enrollment: {
    id: string
    listingId: string
    completedAt: string | null
    trialGrantedAt: string | null
  }
}

/**
 * The signed-in viewer's live tour enrollment, or null.
 *
 * Null means: flag off, signed out, not enrolled, or the read failed. Callers
 * are rendering public pages and a rail that must degrade to "absent", so all
 * four collapse deliberately — distinguishing them here would only tempt a
 * caller into rendering an error a visitor cannot act on. (The evidence reads
 * in lib/tour/verify.ts are the opposite: there `read_failed` must never be
 * mistaken for `no_evidence`.)
 *
 * Wrapped in React cache() so the witness on a page and the rail in the root
 * layout share ONE resolution per request. The rail's extra `auth.getUser()`
 * round-trip per request while the flag is on is a logged, accepted cost —
 * cache() is what keeps it at one, not two or three.
 *
 * The enrollment read uses the tester's own client: the SELECT policy on
 * `tour_enrollments` grants a tester their own rows, so no service role is
 * needed to answer "am I on the tour?".
 */
export const resolveTourViewer = cache(async (): Promise<TourViewer | null> => {
  try {
    if (!isFeatureEnabled('testerTour')) return null

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: enrollment, error } = await supabase
      .from('tour_enrollments')
      .select('id, listing_id, completed_at, trial_granted_at')
      .eq('tester_user_id', user.id)
      .is('ended_at', null)
      .maybeSingle()
    if (error || !enrollment) return null

    return {
      userId: user.id,
      enrollment: {
        id: enrollment.id,
        listingId: enrollment.listing_id,
        completedAt: enrollment.completed_at,
        trialGrantedAt: enrollment.trial_granted_at,
      },
    }
  } catch {
    return null
  }
})

interface ListingWitnessContext {
  /** The listing owner's user id, or null for an unclaimed listing. Required
   *  for `listing_opened` at the type level: opening your OWN listing is not
   *  evidence you explored the marketplace, so the step only counts on someone
   *  else's page. An unclaimed listing (null owner) is by definition not the
   *  tester's own and does count. */
  listingOwnerId: string | null
}

/**
 * Record that an enrolled tester's page render witnessed a tour step.
 *
 * Resolves the viewer during render, then defers the service-role insert to
 * `after()` so the write never adds latency to the page. Never throws; a
 * failure means a missing progress tick, which the tester cures by loading the
 * page again — the same "best effort, page first" contract as
 * `trackServerEvent`.
 *
 * The insert ignores duplicates (the UNIQUE on `(enrollment_id, step_key)`):
 * a witness only ever attests "this happened at least once". It must never
 * touch an existing row, whose `reflection` belongs to the reflection action.
 */
export async function recordTourWitness(
  step: 'listing_opened',
  context: ListingWitnessContext
): Promise<void>
export async function recordTourWitness(
  step: Exclude<WitnessStepKey, 'listing_opened'>
): Promise<void>
export async function recordTourWitness(
  step: WitnessStepKey,
  context?: ListingWitnessContext
): Promise<void> {
  try {
    const viewer = await resolveTourViewer()
    if (!viewer) return

    if (step === 'listing_opened' && context?.listingOwnerId === viewer.userId) return

    const enrollmentId = viewer.enrollment.id
    const stepKey: TourStepKey = step

    after(async () => {
      try {
        const serviceClient = createServiceClient()
        await serviceClient
          .from('tour_step_completions')
          .upsert(
            { enrollment_id: enrollmentId, step_key: stepKey },
            { onConflict: 'enrollment_id,step_key', ignoreDuplicates: true }
          )
      } catch {
        // Best-effort evidence — never surface to the page.
      }
    })
  } catch {
    // Never let the tour break a public page render.
  }
}
