import type { DayHours, HoursOverride } from '@/types'

/**
 * Holiday and one-off hours (ticket 196). Pure helpers shared by the open/closed
 * status, the Visit block, the fixtures and the tests. Dates are `YYYY-MM-DD`
 * keys in the listing's local calendar, which is also the viewer's for a shop
 * you can walk into, so they compare as strings.
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** The date key for `now` in local time. */
export function localDateKey(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** `days` after `now`, as a date key. Fixtures use it so sample overrides never go stale. */
export function futureDateKey(now: Date, days: number): string {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return localDateKey(d)
}

/** Today's override, if the owner set one. */
export function overrideFor(
  overrides: readonly HoursOverride[] | undefined,
  now: Date
): HoursOverride | null {
  if (!overrides?.length) return null
  const key = localDateKey(now)
  return overrides.find((o) => o.date === key) ?? null
}

/** Soonest first; the input is not mutated. */
export function sortOverrides(overrides: readonly HoursOverride[]): HoursOverride[] {
  return [...overrides].sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Today through `days` ahead, soonest first. The loader reads a slightly
 * wider window (see {@link hoursOverrideWindow}) and the page narrows it with
 * this at render, so a viewer west of the server still sees today's row.
 */
export function upcomingOverrides(
  overrides: readonly HoursOverride[] | undefined,
  now: Date,
  days = 30
): HoursOverride[] {
  if (!overrides?.length) return []
  const from = localDateKey(now)
  const to = futureDateKey(now, days)
  return sortOverrides(overrides.filter((o) => o.date >= from && o.date <= to))
}

/**
 * The day's hours under an override: closed, or its own times. Null when an
 * open override has no times (bad data), so callers fall back to the week.
 */
export function overrideDayHours(o: HoursOverride): DayHours | null {
  if (o.closed) return { open: '00:00', close: '00:00', closed: true }
  if (!o.open || !o.close) return null
  return { open: o.open, close: o.close, closed: false }
}

/** "Thu, Nov 26". Parsed as local noon so the day never shifts across time zones. */
export function formatOverrideDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// ── Saved rows (ticket 196) ─────────────────────────────────────────────────

export const HOURS_OVERRIDE_COLUMNS = 'date, closed, open, close, label'
export const HOURS_OVERRIDE_LABEL_MAX = 60
/** How far ahead an owner can plan. */
export const HOURS_OVERRIDE_MAX_AHEAD_DAYS = 365
/** Upcoming dates one page can hold. */
export const HOURS_OVERRIDE_MAX = 60

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** A real calendar date as `YYYY-MM-DD` ("2026-02-30" is not). */
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY.test(value)) return false
  const [y, m, d] = value.split('-').map(Number) as [number, number, number]
  const date = new Date(y, m - 1, d)
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d
}

/**
 * The dates the page loader reads: yesterday through 31 days ahead in the
 * server's calendar. The day of slack either side covers a viewer whose
 * local date differs from the server's; the page narrows it with
 * {@link upcomingOverrides}.
 */
export function hoursOverrideWindow(now: Date): { from: string; to: string } {
  return { from: futureDateKey(now, -1), to: futureDateKey(now, 31) }
}

/** The oldest date the purge keeps: two days back, so no time zone loses today. */
export function hoursOverridePurgeBefore(now: Date): string {
  return futureDateKey(now, -2)
}

/** Rows from the database, checked, soonest first. Bad rows are dropped. */
export function toHoursOverrides(rows: unknown): HoursOverride[] {
  if (!Array.isArray(rows)) return []
  const out: HoursOverride[] = []
  for (const r of rows as Record<string, unknown>[]) {
    if (!isDateKey(r?.date) || typeof r.closed !== 'boolean') continue
    const label = typeof r.label === 'string' && r.label.trim() ? r.label.trim() : null
    if (r.closed) {
      out.push({ date: r.date, closed: true, open: null, close: null, label })
      continue
    }
    if (typeof r.open !== 'string' || typeof r.close !== 'string') continue
    if (!TIME.test(r.open) || !TIME.test(r.close) || r.close <= r.open) continue
    out.push({ date: r.date, closed: false, open: r.open, close: r.close, label })
  }
  return sortOverrides(out)
}

export type ParsedHoursOverride = { ok: true; value: HoursOverride } | { ok: false; error: string }

/**
 * The owner's form, checked the way the table's CHECKs will: a real date
 * from today (a day's slack for time zones) to a year ahead; closed, or open
 * with both times and closing after opening; a reason up to 60 characters.
 */
export function parseHoursOverride(
  input: { date: unknown; closed: unknown; open: unknown; close: unknown; label: unknown },
  now: Date
): ParsedHoursOverride {
  if (!isDateKey(input.date)) return { ok: false, error: 'Choose a date.' }
  if (input.date < futureDateKey(now, -1)) {
    return { ok: false, error: 'That date has passed. Choose today or a later date.' }
  }
  if (input.date > futureDateKey(now, HOURS_OVERRIDE_MAX_AHEAD_DAYS)) {
    return { ok: false, error: 'Choose a date within the next year.' }
  }
  const label = typeof input.label === 'string' ? input.label.replace(/\s+/g, ' ').trim() : ''
  if (label.length > HOURS_OVERRIDE_LABEL_MAX) {
    return { ok: false, error: `Keep the reason to ${HOURS_OVERRIDE_LABEL_MAX} characters.` }
  }
  const base = { date: input.date, label: label || null }
  if (input.closed === true) {
    return { ok: true, value: { ...base, closed: true, open: null, close: null } }
  }
  const open = typeof input.open === 'string' ? input.open.slice(0, 5) : ''
  const close = typeof input.close === 'string' ? input.close.slice(0, 5) : ''
  if (!TIME.test(open) || !TIME.test(close)) {
    return { ok: false, error: 'Set an opening and a closing time, or mark the day closed.' }
  }
  if (close <= open) {
    return {
      ok: false,
      error: 'Closing time must be after opening time. For late nights, end at 11:59 PM.',
    }
  }
  return { ok: true, value: { ...base, closed: false, open, close } }
}

/**
 * Adding a date: the page holds up to {@link HOURS_OVERRIDE_MAX} upcoming
 * ones. Changing a date already saved always works.
 */
export function checkHoursOverrideAdd(
  saved: readonly HoursOverride[],
  date: string
): string | null {
  if (saved.some((o) => o.date === date)) return null
  if (saved.length >= HOURS_OVERRIDE_MAX) {
    return `You can plan up to ${HOURS_OVERRIDE_MAX} special days. Remove one to add another.`
  }
  return null
}
