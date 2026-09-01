'use server'

// The Tester Tour's one write path for reflections (tester-tour-spec.md §6).
//
// Shape copied from subscribeLaunchAction: a `useActionState` server action
// whose state is `{ error } | { success: true } | null`, so the rail's form
// wiring matches the one action pattern this codebase already has.
//
// This action is the ONLY writer allowed to touch `reflection` — the witness
// path (lib/tour/witness.ts) upserts with ignoreDuplicates so it can never
// clobber text written here. Conversely this upsert DOES update on conflict:
// a `search_ran` witness row already exists when its reflection arrives, and
// attaching the text to that row is the entire job.
//
// The write is service-role because both tour tables are SELECT-only under RLS
// on purpose (20260830000000_tester_tour.sql) — a tester who could write their
// own completion rows could mint a free Starter trial. What stands in for RLS
// here is the evidence check: no reflection row is written unless
// lib/tour/verify.ts confirms the underlying thing actually happened, from
// rows a browser cannot forge.

import { createServiceClient } from '@/lib/supabase/server'
import { resolveTourViewer } from '@/lib/tour/witness'
import { verifyReflectionEvidence, TOUR_STEP_COPY } from '@/lib/tour/verify'
import {
  REFLECTION_GATED_STEPS,
  REFLECTION_MIN_LENGTH,
  isSubstantiveReflection,
  type ReflectionGatedStepKey,
} from '@/lib/tour/steps'

export type ReflectionState = { error: string } | { success: true } | null

// One generic string for every "you should not be calling this" path — flag
// off, signed out, not enrolled, viewer read failed. The rail never renders for
// those viewers, so anyone who sees this message is poking the action directly
// and is owed nothing more specific.
const NOT_AVAILABLE = 'The tour isn’t available for this account.'

export async function submitReflectionAction(
  _prev: ReflectionState,
  formData: FormData
): Promise<ReflectionState> {
  // Flag check, auth, and enrollment in one call — resolveTourViewer is
  // cache()d per request, and a server action invocation is its own request,
  // so this costs one auth round-trip and one enrollment read.
  const viewer = await resolveTourViewer()
  if (!viewer) return { error: NOT_AVAILABLE }

  const rawStep = formData.get('step')
  if (
    typeof rawStep !== 'string' ||
    !(REFLECTION_GATED_STEPS as readonly string[]).includes(rawStep)
  ) {
    // An un-gated step key ('listing_opened', 'collection_browsed') lands here
    // too: those rows are written only by page-render witnesses, never by a
    // form post.
    return { error: 'That step doesn’t take a written reflection.' }
  }
  const step = rawStep as ReflectionGatedStepKey

  const rawReflection = formData.get('reflection')
  if (typeof rawReflection !== 'string' || rawReflection.trim().length === 0) {
    return { error: 'Write your reflection before submitting.' }
  }
  const reflection = rawReflection.trim()
  if (!isSubstantiveReflection(reflection)) {
    return {
      error: `A few more words — reflections need at least ${REFLECTION_MIN_LENGTH} characters.`,
    }
  }

  // The evidence gate. The two outcomes get DIFFERENT copy and must never
  // swap: `value: false` is a verified absence (tell them what to go do);
  // `ok: false` is a failed read (their work may already exist — the retry
  // string never tells them to redo anything). See lib/tour/verify.ts.
  const evidence = await verifyReflectionEvidence(step, {
    userId: viewer.userId,
    enrollmentId: viewer.enrollment.id,
  })
  if (!evidence.ok) return { error: TOUR_STEP_COPY[step].retry }
  if (!evidence.value) return { error: TOUR_STEP_COPY[step].action }

  try {
    const serviceClient = createServiceClient()

    // `reflection` and `reflected_at` travel together — the DB CHECK
    // `tour_step_completions_reflection_pair` rejects one without the other.
    // On conflict this UPDATES (no ignoreDuplicates): resubmitting revises
    // your reflection, and a witness-created row gains its text.
    const { error: writeError } = await serviceClient.from('tour_step_completions').upsert(
      {
        enrollment_id: viewer.enrollment.id,
        step_key: step,
        reflection,
        reflected_at: new Date().toISOString(),
      },
      { onConflict: 'enrollment_id,step_key' }
    )
    if (writeError) {
      return { error: 'Couldn’t save your reflection just now. Try again in a moment.' }
    }

    // Completion sweep: once all four gated steps carry substantive text, stamp
    // the enrollment complete. `.is('completed_at', null)` makes the stamp
    // write-once — completion never moves once set, and this action never
    // grants the trial (that is the claim route's job, gated on this stamp).
    //
    // Best-effort past this point on purpose: the reflection IS saved, so a
    // failure here must not report the submission as failed. If the sweep
    // misses, resubmitting any gated step re-runs it — the same
    // "cure by retry" contract as a missed witness.
    try {
      const { data: rows } = await serviceClient
        .from('tour_step_completions')
        .select('step_key, reflection')
        .eq('enrollment_id', viewer.enrollment.id)
        .in('step_key', [...REFLECTION_GATED_STEPS])
      const substantive = new Set(
        (rows ?? [])
          .filter((row) => row.reflection !== null && isSubstantiveReflection(row.reflection))
          .map((row) => row.step_key)
      )
      if (REFLECTION_GATED_STEPS.every((s) => substantive.has(s))) {
        await serviceClient
          .from('tour_enrollments')
          .update({ completed_at: new Date().toISOString() })
          .eq('id', viewer.enrollment.id)
          .is('completed_at', null)
      }
    } catch {
      // Swallowed — see above.
    }

    // No revalidatePath here. The rail's live state is served by the GET-only
    // /api/tour/state route; the client refetches it (and router.refresh()es)
    // after success. revalidatePath('/', 'layout') would purge the whole
    // site's cache for one tester's keystroke.
    return { success: true }
  } catch {
    return { error: 'Couldn’t save your reflection just now. Try again in a moment.' }
  }
}
