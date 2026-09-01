// The Tester Tour's six steps, in the order the rail shows them.
//
// This list is the TypeScript half of a pair. The other half is the `step_key`
// CHECK constraint in supabase/migrations/20260830000000_tester_tour.sql, and
// the two must stay identical: a step added here only would be silently
// unrecordable (the INSERT fails the CHECK), and a step added to the SQL only
// would be permanently unreachable. Both fail quietly rather than loudly, which
// is why tests/tester-tour-trial.test.ts reads the migration's source text and
// asserts the two lists match.

export const TOUR_STEPS = [
  'search_ran',
  'listing_opened',
  'listing_saved',
  'collection_browsed',
  'review_or_correction',
  'final_reflection',
] as const

export type TourStepKey = (typeof TOUR_STEPS)[number]

// Only four of the six ask the tester to write anything.
//
// The original design gated all six. Asking for twenty considered characters
// about "you loaded a collection page" is high tax and low signal — it is the
// step a tester abandons on, and abandonment costs us the whole walk, not one
// answer. `listing_opened` and `collection_browsed` stay as un-gated progress
// ticks: the witness row still records that the page was rendered, so the
// evidence is unchanged. Only the completion predicate and the rail copy differ.
//
// The schema is deliberately unchanged by this: `reflection` is nullable, so an
// un-gated step's row is a complete row with a NULL reflection, not a
// half-written one.
export const REFLECTION_GATED_STEPS = [
  'search_ran',
  'listing_saved',
  'review_or_correction',
  'final_reflection',
] as const satisfies readonly TourStepKey[]

export type ReflectionGatedStepKey = (typeof REFLECTION_GATED_STEPS)[number]

export function isReflectionGated(step: TourStepKey): step is ReflectionGatedStepKey {
  return (REFLECTION_GATED_STEPS as readonly TourStepKey[]).includes(step)
}

// The floor the rail advertises. Enforced in three places on purpose — the rail
// (so the tester sees it before submitting), the server action (so a client that
// skips the rail still meets it), and the database CHECK
// `tour_step_completions_reflection_substantive` (so no future caller can bypass
// it at all). The database compares against btrim'd text, so twenty spaces is
// not a reflection; anything checking this constant must trim first or the three
// layers disagree.
export const REFLECTION_MIN_LENGTH = 20

export function isSubstantiveReflection(text: string): boolean {
  return text.trim().length >= REFLECTION_MIN_LENGTH
}
