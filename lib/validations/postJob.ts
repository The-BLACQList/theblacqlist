import { z } from 'zod'
import {
  JOB_EMPLOYMENT_TYPES,
  JOB_SALARY_PERIODS,
  JOB_WORKPLACE_TYPES,
} from '@/lib/constants/listing'

// Ticket 152: the one schema behind "Post a job". The wizard runs it per step in
// the browser and postJobAction runs the same thing again on the server. Every
// field is a plain string (what an input holds); all rules live in superRefine so
// the failures are deterministic and the same on both sides.

export const POST_JOB_STEPS = ['The role', 'Pay and place', 'How to apply', 'Review'] as const

/** Which fields belong to which step, so a step only shows its own errors. */
export const POST_JOB_STEP_FIELDS: readonly (readonly PostJobField[])[] = [
  ['hiringListingId', 'name', 'tagline', 'categoryId', 'employmentType', 'workplaceType'],
  ['salaryMin', 'salaryMax', 'salaryPeriod', 'closesAt'],
  ['applyUrl', 'applyEmail', 'description'],
  [],
]

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MONEY_RE = /^\d{1,9}(\.\d{1,2})?$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const str = z.string()

export const postJobBaseSchema = z.object({
  hiringListingId: str,
  name: str,
  tagline: str,
  categoryId: str,
  employmentType: str,
  workplaceType: str,
  salaryMin: str,
  salaryMax: str,
  salaryPeriod: str,
  closesAt: str,
  applyUrl: str,
  applyEmail: str,
  description: str,
})

export type PostJobValues = z.infer<typeof postJobBaseSchema>
export type PostJobField = keyof PostJobValues
export type PostJobErrors = Partial<Record<PostJobField, string>>

export const EMPTY_POST_JOB: PostJobValues = {
  hiringListingId: '',
  name: '',
  tagline: '',
  categoryId: '',
  employmentType: '',
  workplaceType: 'on-site',
  salaryMin: '',
  salaryMax: '',
  salaryPeriod: '',
  closesAt: '',
  applyUrl: '',
  applyEmail: '',
  description: '',
}

/** Today's calendar day in Eastern time, "YYYY-MM-DD" (the way closing dates are shown). */
export function easternToday(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

/** The furthest a closing date can be set, in days from today (founder, 2026-10-30). */
export const MAX_CLOSE_DAYS = 90

/** The latest allowed closing day, "YYYY-MM-DD": today in Eastern time plus MAX_CLOSE_DAYS. */
export function latestCloseDay(now: Date = new Date()): string {
  const d = new Date(`${easternToday(now)}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + MAX_CLOSE_DAYS)
  return d.toISOString().slice(0, 10)
}

/**
 * The instant a role closes: the last minute of the chosen calendar day in
 * Eastern time. Stored this way so formatCloseDate shows the day the poster
 * picked (midnight UTC would show the day before).
 */
export function endOfDayEastern(day: string): string {
  for (const offset of ['-04:00', '-05:00']) {
    const d = new Date(`${day}T23:59:00${offset}`)
    if (!isNaN(d.getTime()) && easternToday(d) === day) return d.toISOString()
  }
  return new Date(`${day}T23:59:00-05:00`).toISOString()
}

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v)
    return u.protocol === 'https:' || u.protocol === 'http:'
  } catch {
    return false
  }
}

export function isVolunteer(employmentType: string): boolean {
  return employmentType === 'volunteer'
}

export const postJobSchema = postJobBaseSchema.superRefine((raw, ctx) => {
  const fail = (path: PostJobField, message: string) =>
    ctx.addIssue({ code: 'custom', path: [path], message })

  const name = raw.name.trim()
  const tagline = raw.tagline.trim()
  const description = raw.description.trim()
  const applyUrl = raw.applyUrl.trim()
  const applyEmail = raw.applyEmail.trim()

  if (!UUID_RE.test(raw.hiringListingId)) fail('hiringListingId', 'Pick the business that is hiring.')
  if (name.length < 2) fail('name', 'Add a job title (at least 2 characters).')
  else if (name.length > 120) fail('name', 'Keep the title to 120 characters or fewer.')
  if (tagline.length < 10) fail('tagline', 'Add a one-line summary (at least 10 characters).')
  else if (tagline.length > 120) fail('tagline', 'Keep the summary to 120 characters or fewer.')
  if (!UUID_RE.test(raw.categoryId)) fail('categoryId', 'Choose a category.')
  if (!(JOB_EMPLOYMENT_TYPES as readonly string[]).includes(raw.employmentType)) {
    fail('employmentType', 'Choose the kind of work.')
  }
  if (!(JOB_WORKPLACE_TYPES as readonly string[]).includes(raw.workplaceType)) {
    fail('workplaceType', 'Choose where the work is done.')
  }

  // Pay (Q4). Required for anything that is not volunteer. `[Needs professional
  // review]` Pay-transparency rules vary by state and city; counsel confirms the
  // field set. Enforced here and in the server action, not in the database.
  if (!isVolunteer(raw.employmentType)) {
    const min = raw.salaryMin.trim()
    const max = raw.salaryMax.trim()
    if (!min) fail('salaryMin', 'Add the lowest pay.')
    else if (!MONEY_RE.test(min)) fail('salaryMin', 'Enter an amount like 18 or 18.50.')
    if (!max) fail('salaryMax', 'Add the highest pay.')
    else if (!MONEY_RE.test(max)) fail('salaryMax', 'Enter an amount like 22 or 22.50.')
    if (MONEY_RE.test(min) && MONEY_RE.test(max) && Number(max) < Number(min)) {
      fail('salaryMax', 'The highest pay must be at least the lowest.')
    }
    if (!(JOB_SALARY_PERIODS as readonly string[]).includes(raw.salaryPeriod)) {
      fail('salaryPeriod', 'Choose how often the pay is paid.')
    }
  }

  const closes = raw.closesAt.trim()
  if (closes) {
    if (!DATE_RE.test(closes) || isNaN(new Date(`${closes}T12:00:00Z`).getTime())) {
      fail('closesAt', 'Enter a valid closing date.')
    } else if (closes < easternToday()) {
      fail('closesAt', 'The closing date must be today or later.')
    } else if (closes > latestCloseDay()) {
      fail('closesAt', `The closing date can be at most ${MAX_CLOSE_DAYS} days from today.`)
    }
  }

  if (!applyUrl && !applyEmail) {
    fail('applyUrl', 'Add an application link or an email to apply to.')
  }
  if (applyUrl && !isHttpUrl(applyUrl)) fail('applyUrl', 'The link must start with https://')
  if (applyEmail && !EMAIL_RE.test(applyEmail)) fail('applyEmail', 'Enter a valid email address.')

  if (description.length < 20) fail('description', 'Describe the role (at least 20 characters).')
  else if (description.length > 2000) fail('description', 'Keep this to 2000 characters or fewer.')
})

/** All field errors for the whole form, first message per field. */
export function validatePostJob(values: PostJobValues): PostJobErrors {
  const result = postJobSchema.safeParse(values)
  const out: PostJobErrors = {}
  if (result.success) return out
  for (const issue of result.error.issues) {
    const key = issue.path[0] as PostJobField | undefined
    if (key && !out[key]) out[key] = issue.message
  }
  return out
}

/** Errors for one step (0 based) only. */
export function validatePostJobStep(values: PostJobValues, step: number): PostJobErrors {
  const all = validatePostJob(values)
  const out: PostJobErrors = {}
  for (const f of POST_JOB_STEP_FIELDS[step] ?? []) {
    const m = all[f]
    if (m) out[f] = m
  }
  return out
}

/** The first step (0 based) that has an error, or null. */
export function firstStepWithError(errors: PostJobErrors): number | null {
  for (let i = 0; i < POST_JOB_STEP_FIELDS.length; i++) {
    if ((POST_JOB_STEP_FIELDS[i] ?? []).some((f) => errors[f])) return i
  }
  return null
}

/** Draft ids are client generated (the idempotency key). */
export const attemptIdSchema = z.string().regex(UUID_RE)
