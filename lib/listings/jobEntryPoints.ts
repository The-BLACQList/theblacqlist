import { JOB_POSTING_PRICE_DISPLAY } from '@/lib/stripe/jobPostings'

// Pure copy and mapping helpers for where Jobs shows up (ticket 154): the home
// tile, the dashboard card and the business page block. Kept free of Supabase so
// they are unit testable.

/**
 * The line under "Jobs" on the home tile. `null` means the count read failed, so
 * the tile promises no number it cannot back up.
 */
export function jobsTileLabel(count: number | null): string {
  if (count === null) return 'Find your next role'
  if (count === 0) return 'No open roles yet'
  return `${count.toLocaleString('en-US')} open ${count === 1 ? 'role' : 'roles'}`
}

/**
 * The home counts with the Jobs count added only when Jobs is open. Leaving the
 * key off is what hides the tile, so a covered Jobs never shows on the home page.
 */
export function withJobsCount<T extends object>(
  base: T,
  jobsOpen: boolean,
  jobs: number | null
): T & { jobs?: number | null } {
  return jobsOpen ? { ...base, jobs } : base
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']

/** "One index, five avenues" while five tiles show; "six" once Jobs joins. */
export function avenuesEyebrow(tiles: number): string {
  return `One index, ${NUMBER_WORDS[tiles] ?? String(tiles)} avenues`
}

interface QuotaLike {
  limit: number | null
  used: number
}

/**
 * The line under "Post a job" on the dashboard. Null when the quota read failed:
 * the button still shows, with no count.
 */
export function postJobQuotaLine(quota: QuotaLike | null): string | null {
  if (!quota) return null
  if (quota.limit === null) return 'Your plan includes unlimited job postings'
  if (quota.limit === 0) return `Each role is ${JOB_POSTING_PRICE_DISPLAY} for 30 days`
  const left = Math.max(0, quota.limit - quota.used)
  return `${left} of ${quota.limit} included postings left`
}

/** Link text under three cards when the business has more open roles. */
export function seeAllRolesLabel(total: number): string {
  return `See all ${total} roles`
}
