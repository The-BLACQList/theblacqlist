import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveTourViewer } from '@/lib/tour/witness'
import {
  TOUR_STEP_COPY,
  verifyListingSaved,
  verifyReviewOrCorrection,
  type TourReadResult,
} from '@/lib/tour/verify'
import {
  TOUR_STEPS,
  isReflectionGated,
  isSubstantiveReflection,
  type TourStepKey,
} from '@/lib/tour/steps'

// GET-only tour state for the rail's client chunk (tester-tour-spec.md §6–7).
//
// This route — not the root layout — is where the derived `saves` / `reviews`
// evidence reads live. The layout path renders on every page view sitewide and
// may load only the enrollment and its six completion rows; the heavier reads
// run here, on demand, for enrolled testers only.
//
// Per-step statuses the rail switches on, with the copy already resolved
// server-side so the client stays dumb:
//
//   'done'    — the step is finished (gated: substantive reflection attached;
//               un-gated: witness row exists)
//   'reflect' — evidence verified, reflection still owed (`prompt` applies)
//   'act'     — verified NO evidence yet (`message` = action copy)
//   'retry'   — an evidence read FAILED (`message` = retry copy). Never
//               collapsed into 'act': telling a tester who already did the
//               thing to go do it is the failure mode lib/tour/verify.ts
//               exists to prevent.

// A flag read during static prerendering is baked into the HTML at build time
// (lib/env.ts). resolveTourViewer's cookie read already forces this route
// dynamic; the export makes that a stated property instead of a side effect.
export const dynamic = 'force-dynamic'

type TourStepStatus = 'done' | 'reflect' | 'act' | 'retry'

interface TourStepState {
  key: TourStepKey
  title: string
  gated: boolean
  status: TourStepStatus
  /** The reflection prompt, for gated steps — shown at 'reflect'. */
  prompt: string | null
  /** Resolved copy for 'act' and 'retry'; null at 'done' and 'reflect'. */
  message: string | null
}

interface CompletionRow {
  step_key: string
  reflection: string | null
}

function hasSubstantiveReflection(row: CompletionRow | undefined): boolean {
  return row?.reflection != null && isSubstantiveReflection(row.reflection)
}

function stepState(
  key: TourStepKey,
  status: TourStepStatus
): TourStepState {
  const copy = TOUR_STEP_COPY[key]
  return {
    key,
    title: copy.title,
    gated: isReflectionGated(key),
    status,
    prompt: copy.prompt,
    message:
      status === 'act' ? copy.action : status === 'retry' ? copy.retry : null,
  }
}

// A gated step whose evidence lives OUTSIDE the completions table
// (listing_saved, review_or_correction): done once reflected, otherwise the
// three-way evidence verdict decides.
function derivedStepState(
  key: TourStepKey,
  row: CompletionRow | undefined,
  evidence: TourReadResult<boolean>
): TourStepState {
  if (hasSubstantiveReflection(row)) return stepState(key, 'done')
  if (!evidence.ok) return stepState(key, 'retry')
  return stepState(key, evidence.value ? 'reflect' : 'act')
}

export async function GET() {
  // One 404 for flag-off, signed-out, and not-enrolled alike — this route's
  // existence is itself gated, and none of the three callers is owed a
  // distinction (resolveTourViewer collapses them on purpose).
  const viewer = await resolveTourViewer()
  if (!viewer) {
    return NextResponse.json({ error: 'Not found.', code: 'NOT_FOUND' }, { status: 404 })
  }

  try {
    const serviceClient = createServiceClient()
    const { data, error } = await serviceClient
      .from('tour_step_completions')
      .select('step_key, reflection')
      .eq('enrollment_id', viewer.enrollment.id)
    if (error) throw new Error(error.message)

    const rows = new Map<string, CompletionRow>((data ?? []).map((row) => [row.step_key, row]))

    // The two derived reads run only when their step still needs evidence — a
    // reflected step's own row IS the record, so its source read is skipped.
    const [savedEvidence, reviewEvidence] = await Promise.all([
      hasSubstantiveReflection(rows.get('listing_saved'))
        ? Promise.resolve<TourReadResult<boolean>>({ ok: true, value: true })
        : verifyListingSaved(viewer.userId),
      hasSubstantiveReflection(rows.get('review_or_correction'))
        ? Promise.resolve<TourReadResult<boolean>>({ ok: true, value: true })
        : verifyReviewOrCorrection(viewer.userId),
    ])

    const steps: TourStepState[] = TOUR_STEPS.map((key) => {
      switch (key) {
        // Gated; its evidence is its own witness row, already in hand.
        case 'search_ran': {
          const row = rows.get(key)
          if (hasSubstantiveReflection(row)) return stepState(key, 'done')
          return stepState(key, row ? 'reflect' : 'act')
        }
        // Un-gated progress ticks: the witness row is the whole step.
        case 'listing_opened':
        case 'collection_browsed':
          return stepState(key, rows.has(key) ? 'done' : 'act')
        case 'listing_saved':
          return derivedStepState(key, rows.get(key), savedEvidence)
        case 'review_or_correction':
          return derivedStepState(key, rows.get(key), reviewEvidence)
        // Gated; its evidence is the three written steps above it, already in
        // hand. (The action re-verifies with fresh reads on submit — this is
        // display state, not the gate.)
        case 'final_reflection': {
          const row = rows.get(key)
          if (hasSubstantiveReflection(row)) return stepState(key, 'done')
          const priorsDone = (['search_ran', 'listing_saved', 'review_or_correction'] as const).every(
            (prior) => hasSubstantiveReflection(rows.get(prior))
          )
          return stepState(key, priorsDone ? 'reflect' : 'act')
        }
      }
    })

    return NextResponse.json({
      data: {
        listingId: viewer.enrollment.listingId,
        completedAt: viewer.enrollment.completedAt,
        trialGrantedAt: viewer.enrollment.trialGrantedAt,
        canClaim:
          viewer.enrollment.completedAt !== null && viewer.enrollment.trialGrantedAt === null,
        steps,
      },
    })
  } catch {
    // The completions read failing means we know nothing about ANY step, so no
    // per-step verdicts leave this route at all — a 500 makes the rail show
    // one rail-level "couldn't load" retry instead of six confident lies.
    return NextResponse.json(
      { error: 'Couldn’t load your tour progress. Try again in a moment.', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
