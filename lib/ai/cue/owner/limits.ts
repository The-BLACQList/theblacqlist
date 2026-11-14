/**
 * The owner Cue's limits (ticket 203). Pure, so the tests can read them.
 *
 * Per owner: 20 messages an hour, 100 a day (bucket 'owner_cue'). Across all
 * owners: 20% of the monthly call budget, counting each message as
 * cueMessageUnits() calls, the loop's worst case. Drafts also use the page's
 * own writing-help allowance, through requestSuggestion.
 */

export const OWNER_CUE_PER_HOUR = 20
export const OWNER_CUE_PER_DAY = 100
export const OWNER_CUE_BUDGET_SHARE = 0.2

export function ownerCueCallBudget(monthlyBudget: number): number {
  if (!Number.isFinite(monthlyBudget) || monthlyBudget <= 0) return 0
  return Math.floor(monthlyBudget * OWNER_CUE_BUDGET_SHARE)
}

/** True when one more message, at `units` calls, fits in the owner share. */
export function withinOwnerCueBudget(
  usedUnits: number,
  units: number,
  monthlyBudget: number
): boolean {
  return usedUnits + units <= ownerCueCallBudget(monthlyBudget)
}
