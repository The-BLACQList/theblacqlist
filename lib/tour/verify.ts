// Tester Tour evidence verification: the reads behind the four reflection-gated
// steps, and the copy the rail shows for every step.
//
// The one rule that shapes everything here (tester-tour-spec.md §3): a failed
// read is `read_failed`, NEVER `no_evidence`. They are different facts. Telling
// a tester who already searched to go and search — because a query timed out —
// is the failure mode that makes the whole instrument untrustworthy. So every
// read returns a `TourReadResult` that keeps the two apart, and every step
// carries a distinct `retry` string so no code path can render action copy off
// the back of a failure.
//
// Evidence comes only from rows a browser cannot write:
//
//   * `tour_step_completions` — witness rows the service role wrote inside a
//     real page render (lib/tour/witness.ts);
//   * first-party `saves`, `reviews`, and `moderation_queue` rows.
//
// Nothing here reads `analytics_events`. That table is client-writable by
// design, so a row in it proves a browser sent a POST — not that a person did
// a thing. The test suite enforces this with a double whose
// `from('analytics_events')` throws.
//
// Every function here uses the service client and must be called only from
// trusted server code — the reflection action and the GET-only tour-state
// route. Service-role reads are deliberate, not lazy: RLS forces newly
// submitted reviews to `intake` and hides them, and a review counts in ANY
// status — filtering by a published status would make step 5 permanently
// unreachable for exactly the testers who used the product.

import { createServiceClient } from '@/lib/supabase/server'
import {
  REFLECTION_GATED_STEPS,
  isSubstantiveReflection,
  type ReflectionGatedStepKey,
  type TourStepKey,
} from '@/lib/tour/steps'

// Same shape as `ReadResult` in lib/stripe/jobPostings.ts, for the same reason:
// the caller must not be able to confuse "I looked and found nothing" with "I
// could not look". `{ ok: true, value: false }` is a verified absence of
// evidence; `{ ok: false }` is a read failure whose only honest rendering is
// the step's `retry` copy.
export type TourReadResult<T> = { ok: true; value: T } | { ok: false; error: string }

export interface TourStepCopy {
  /** The step's name in the rail. */
  title: string
  /** Shown when the step verifiably has no evidence yet: what to go do. */
  action: string
  /**
   * Shown when an evidence read FAILED. Must never tell the tester to do or
   * redo the thing — their work may already exist. Distinct per step so a test
   * can prove no two paths share a string and no `retry` leaks action copy.
   */
  retry: string
  /** The reflection prompt — null for the two un-gated progress ticks. */
  prompt: string | null
}

export const TOUR_STEP_COPY: Record<TourStepKey, TourStepCopy> = {
  search_ran: {
    title: 'Run a real search',
    action: 'Search for something you would genuinely look for — a city, a category, a name.',
    retry:
      'We couldn’t confirm your search step just now. Reload in a moment — if you already searched, that still counts.',
    prompt: 'What did you search for, and did the results match what you expected?',
  },
  listing_opened: {
    title: 'Open a listing that isn’t yours',
    action: 'Open any listing that isn’t your own — from search, a city page, or a collection.',
    retry:
      'We couldn’t confirm the listing step just now. Reload in a moment — if you already opened one, that still counts.',
    prompt: null,
  },
  listing_saved: {
    title: 'Save a listing that isn’t yours',
    action: 'Tap Save on a listing that isn’t your own.',
    retry:
      'We couldn’t check your saves just now. Reload in a moment — a save you already made still counts.',
    prompt: 'What made you save that one?',
  },
  collection_browsed: {
    title: 'Browse a collection',
    action: 'Open any collection page and look around.',
    retry:
      'We couldn’t confirm the collection step just now. Reload in a moment — if you already browsed one, that still counts.',
    prompt: null,
  },
  review_or_correction: {
    title: 'Leave a review or report a correction',
    action:
      'Leave a review on a listing you know, or report a correction on one that looks out of date.',
    retry:
      'We couldn’t check your reviews and reports just now. Reload in a moment — one you already submitted still counts.',
    prompt: 'How did leaving that feel — easy, awkward, worth it?',
  },
  final_reflection: {
    title: 'Reflect on the whole walk',
    action: 'Finish the three written steps above first — the final reflection unlocks last.',
    retry:
      'We couldn’t load your progress just now. Reload in a moment — everything you’ve done is safe.',
    prompt: 'Overall: what worked, what didn’t, and would you tell a friend to use this?',
  },
}

/**
 * Has this tester saved a listing that is not their own?
 *
 * The ownership filter runs in JS, not as `.neq('listings.owner_user_id', …)`,
 * because Postgres `neq` excludes NULLs — and an unclaimed listing (null
 * owner) is by definition not the tester's own, so it must count. A save whose
 * listing join comes back empty proves nothing about ownership and is not
 * counted; refusing to count an unverifiable row errs the same safe direction
 * as the rest of this file.
 */
export async function verifyListingSaved(userId: string): Promise<TourReadResult<boolean>> {
  try {
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('saves')
      .select('listing_id, listings ( owner_user_id )')
      .eq('user_id', userId)
    if (error) return { ok: false, error: error.message }

    const hasEvidence = (data ?? []).some(
      (save) => save.listings !== null && save.listings.owner_user_id !== userId
    )
    return { ok: true, value: hasEvidence }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'saves read failed' }
  }
}

/**
 * Has this tester left a review — in ANY status — or submitted a correction?
 *
 * Any status, on purpose: RLS forces a newly submitted review to `intake`, so
 * a published-only filter makes this step permanently unreachable (spec §3).
 * The correction half matches what submitCorrectionAction actually writes:
 * `queue_type = 'correction'` with `submitted_by` set for a signed-in
 * submitter. A signed-out correction has a null `submitted_by` and cannot be
 * attributed — testers are signed in, so that is correct, not a gap.
 *
 * Both reads run; evidence in either is enough. Only when NEITHER found
 * evidence does a failure in either matter — half-blind "no evidence" is
 * exactly the lie this file exists to prevent.
 */
export async function verifyReviewOrCorrection(userId: string): Promise<TourReadResult<boolean>> {
  try {
    const serviceClient = createServiceClient()
    const [reviews, corrections] = await Promise.all([
      serviceClient
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('reviewer_user_id', userId),
      serviceClient
        .from('moderation_queue')
        .select('id', { count: 'exact', head: true })
        .eq('queue_type', 'correction')
        .eq('submitted_by', userId),
    ])

    const reviewEvidence = !reviews.error && (reviews.count ?? 0) > 0
    const correctionEvidence = !corrections.error && (corrections.count ?? 0) > 0
    if (reviewEvidence || correctionEvidence) return { ok: true, value: true }

    if (reviews.error) return { ok: false, error: reviews.error.message }
    if (corrections.error) return { ok: false, error: corrections.error.message }
    return { ok: true, value: false }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'evidence read failed' }
  }
}

/**
 * Does a witness row exist for this step on this enrollment?
 *
 * `search_ran`'s evidence is its own witness row — the service role wrote it
 * inside a real search render, which is exactly the attestation the reflection
 * needs before it may attach text to it.
 */
export async function verifyWitnessRow(
  enrollmentId: string,
  step: TourStepKey
): Promise<TourReadResult<boolean>> {
  try {
    const serviceClient = createServiceClient()
    const { count, error } = await serviceClient
      .from('tour_step_completions')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollmentId)
      .eq('step_key', step)
    if (error) return { ok: false, error: error.message }
    return { ok: true, value: (count ?? 0) > 0 }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'completions read failed' }
  }
}

/**
 * Are the three earlier reflection-gated steps each done with substantive text?
 *
 * This is `final_reflection`'s prerequisite: reflecting on the whole walk only
 * means something once the walk's written steps exist. The DB CHECK already
 * guarantees any non-null reflection meets the 20-character trimmed floor;
 * `isSubstantiveReflection` re-checks anyway so this function's verdict never
 * silently depends on a constraint someone might relax.
 */
export async function verifyPriorReflections(
  enrollmentId: string
): Promise<TourReadResult<boolean>> {
  const priorSteps = REFLECTION_GATED_STEPS.filter((s) => s !== 'final_reflection')
  try {
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('tour_step_completions')
      .select('step_key, reflection')
      .eq('enrollment_id', enrollmentId)
      .in('step_key', priorSteps)
    if (error) return { ok: false, error: error.message }

    const substantive = new Set(
      (data ?? [])
        .filter((row) => row.reflection !== null && isSubstantiveReflection(row.reflection))
        .map((row) => row.step_key)
    )
    return { ok: true, value: priorSteps.every((s) => substantive.has(s)) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'completions read failed' }
  }
}

/**
 * The one entry point the reflection action uses: does this reflection-gated
 * step have the evidence that entitles it to a reflection?
 *
 *   * `search_ran`            → its own witness row exists
 *   * `listing_saved`         → a save of someone else's listing exists
 *   * `review_or_correction`  → a review (any status) or an attributed correction exists
 *   * `final_reflection`      → the three steps above each carry substantive text
 */
export async function verifyReflectionEvidence(
  step: ReflectionGatedStepKey,
  ctx: { userId: string; enrollmentId: string }
): Promise<TourReadResult<boolean>> {
  switch (step) {
    case 'search_ran':
      return verifyWitnessRow(ctx.enrollmentId, 'search_ran')
    case 'listing_saved':
      return verifyListingSaved(ctx.userId)
    case 'review_or_correction':
      return verifyReviewOrCorrection(ctx.userId)
    case 'final_reflection':
      return verifyPriorReflections(ctx.enrollmentId)
  }
}
