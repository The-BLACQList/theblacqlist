import { isEventOver } from '@/lib/events/eventOver'

/** One event on a host page's Events tab (ticket 106). */
export interface OwnerEventRow {
  id: string
  name: string
  status: string
  startsAt: string | null
  endsAt: string | null
  publicUrl: string
}

/**
 * Splits a page's events into upcoming (soonest first) and past (latest first).
 * Past uses the same rule as the nightly sweep, so an event never sits under
 * "Upcoming" here while the site has already taken it down.
 */
export function splitOwnerEvents(
  rows: OwnerEventRow[],
  now: Date = new Date()
): { upcoming: OwnerEventRow[]; past: OwnerEventRow[] } {
  const time = (r: OwnerEventRow) => (r.startsAt ? new Date(r.startsAt).getTime() : 0)
  const upcoming: OwnerEventRow[] = []
  const past: OwnerEventRow[] = []
  for (const row of rows) {
    if (isEventOver(row.startsAt, row.endsAt, now)) past.push(row)
    else upcoming.push(row)
  }
  upcoming.sort((a, b) => time(a) - time(b))
  past.sort((a, b) => time(b) - time(a))
  return { upcoming, past }
}

/**
 * The status an owner sees, in plain words. The sweep moves a finished event
 * to `unpublished`, so that reads as "Ended" when the date is past.
 */
export function ownerEventStatusLabel(status: string, over: boolean): string {
  switch (status) {
    case 'published':
      return 'Live'
    case 'pending':
      return 'In review'
    case 'draft':
      return 'Draft'
    case 'rejected':
      return 'Not approved'
    case 'unpublished':
      return over ? 'Ended' : 'Unpublished'
    default:
      return 'Hidden'
  }
}

/**
 * The allowance line under the Events heading. Only shown on a plan that
 * includes events; a plan without them gets its own note instead.
 */
export function eventAllowanceLine(limit: number | null, used: number): string {
  if (limit === null) return 'Your plan includes unlimited events.'
  const left = Math.max(limit - used, 0)
  return `${used} of ${limit} active events used. ${left} left.`
}
