import { canAccess } from '@/lib/stripe/features'
import { endsLabel } from '@/lib/listings/happeningNow'

// =============================================================================
// Coupons and deals (owner-experience round 2, part G, 2026-11-13)
// =============================================================================
// A Premium page can show deals in a "Deals" section: a title, an optional
// line about it, an optional code, optional terms, a start and an optional end
// (listing_deals, migration 20261117000000). The business honours the code
// itself; nothing here redeems anything, and every customer sees the same code.
//
// When a deal shows: status 'active', now >= starts_at, and no end or an end
// later than now. Decided here and in RLS when the deal is read, so nothing has
// to run when a deal ends.
//
// Who shows deals: Premium pages only (canAccess(tier, 'coupons')). A page that
// moves down a plan keeps its deals saved but shows none, and they show again
// on upgrade. At most DEALS_ON_MAX are on (live or scheduled) at once.
//
// Pure and client-safe: the page read, the actions and the editor share it.
// =============================================================================

export const DEAL_TITLE_MAX = 80
export const DEAL_DESCRIPTION_MAX = 300
export const DEAL_TERMS_MAX = 300
export const DEAL_CODE_MAX = 40
/** Deals on at once (live or scheduled). Also the most a page shows. */
export const DEALS_ON_MAX = 10
/** Saved deals per page, drafts and ended ones included. */
export const DEALS_SAVED_MAX = 30
/** How far ahead a deal can be scheduled. */
export const DEAL_MAX_LEAD_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

export type DealStatus = 'draft' | 'active' | 'ended'

/** Where a deal is now, from the owner's side. */
export type DealState = 'draft' | 'scheduled' | 'live' | 'ended'

/** One saved deal, as the owner sees it. Times are ISO strings. */
export interface OwnerDeal {
  id: string
  title: string
  description: string | null
  code: string | null
  terms: string | null
  starts_at: string
  /** null: runs until the owner ends it. */
  ends_at: string | null
  status: DealStatus
  created_at: string
}

/** A deal ready for the public page. */
export interface PublicDeal {
  id: string
  title: string
  description: string | null
  code: string | null
  terms: string | null
  endsAt: string | null
}

type Timed = Pick<OwnerDeal, 'status' | 'starts_at' | 'ends_at'>

function ms(iso: string): number {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : Number.NaN
}

/** The plan check: Premium only. */
export function dealsAllowed(tier: string | null | undefined): boolean {
  return canAccess(tier ?? null, 'coupons')
}

export function dealState(deal: Timed, now: Date): DealState {
  if (deal.status === 'draft') return 'draft'
  const t = now.getTime()
  if (deal.status === 'ended') return 'ended'
  if (deal.ends_at !== null && !(ms(deal.ends_at) > t)) return 'ended'
  return ms(deal.starts_at) <= t ? 'live' : 'scheduled'
}

/** Showing to the public right now (before the plan check). */
export function isLiveDeal(deal: Timed, now: Date): boolean {
  return dealState(deal, now) === 'live'
}

/** On, live or scheduled: what DEALS_ON_MAX counts. */
export function dealIsOn(deal: Timed, now: Date): boolean {
  const state = dealState(deal, now)
  return state === 'live' || state === 'scheduled'
}

/**
 * Which deals the page shows on this plan. None unless the page is on Premium.
 * The cap keeps the oldest; the shown ones come back soonest ending first, with
 * deals that have no end after the dated ones.
 */
export function shownDeals<T extends Timed & Pick<OwnerDeal, 'created_at'>>(
  deals: readonly T[],
  tier: string | null | undefined,
  now: Date
): { shown: T[]; hidden: T[] } {
  const live = deals
    .filter((d) => isLiveDeal(d, now))
    .sort((a, b) => ms(a.created_at) - ms(b.created_at))
  if (!dealsAllowed(tier)) return { shown: [], hidden: live }
  const shown = live.slice(0, DEALS_ON_MAX)
  const hidden = live.slice(DEALS_ON_MAX)
  const end = (d: T) => (d.ends_at === null ? Number.POSITIVE_INFINITY : ms(d.ends_at))
  return { shown: [...shown].sort((a, b) => end(a) - end(b)), hidden }
}

/** "Ends in 3 days", or null for a deal with no end. */
export function dealEndsLabel(endsAt: string | null, now: Date): string | null {
  return endsAt === null ? null : endsLabel(endsAt, now)
}

const STATUSES: readonly DealStatus[] = ['draft', 'active', 'ended']

function text(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

/** Rows from listing_deals, with anything malformed left out. */
export function toOwnerDeals(rows: unknown): OwnerDeal[] {
  if (!Array.isArray(rows)) return []
  return rows.flatMap((r): OwnerDeal[] => {
    const row = r as Partial<Record<keyof OwnerDeal, unknown>> | null
    if (!row || typeof row.id !== 'string' || typeof row.title !== 'string') return []
    if (typeof row.starts_at !== 'string') return []
    if (row.ends_at !== null && row.ends_at !== undefined && typeof row.ends_at !== 'string')
      return []
    if (!STATUSES.includes(row.status as DealStatus)) return []
    return [
      {
        id: row.id,
        title: row.title,
        description: text(row.description),
        code: text(row.code),
        terms: text(row.terms),
        starts_at: row.starts_at,
        ends_at: typeof row.ends_at === 'string' ? row.ends_at : null,
        status: row.status as DealStatus,
        created_at: typeof row.created_at === 'string' ? row.created_at : row.starts_at,
      },
    ]
  })
}

export function toPublicDeal(deal: OwnerDeal): PublicDeal {
  return {
    id: deal.id,
    title: deal.title,
    description: deal.description,
    code: deal.code,
    terms: deal.terms,
    endsAt: deal.ends_at,
  }
}

// ── Checking what the owner wrote ───────────────────────────────────────────

/** The fields a deal saves, checked. */
export interface DealFields {
  title: string
  description: string | null
  code: string | null
  terms: string | null
  starts_at: string
  ends_at: string | null
}

export type ParsedDeal = { ok: true; value: DealFields } | { ok: false; error: string }

/** Matches listing_deals_code_check. */
export const DEAL_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/
// Links have no place in a deal: the page already has the business's buttons.
const LINK_IN_TEXT =
  /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|co|io|biz|info|shop|store|link|ly)\b/i
// Line breaks and other control characters become spaces: each field is one line.
const CONTROL = /[\u0000-\u001f\u007f]+/g

function oneLine(value: unknown): string {
  return typeof value === 'string' ? value.replace(CONTROL, ' ').replace(/\s+/g, ' ').trim() : ''
}

function parseTime(value: unknown): number | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const t = Date.parse(value)
  return Number.isFinite(t) ? t : null
}

/**
 * Checks a deal. `startsAt` blank or in the past means now, except a deal
 * already running keeps the start it has (`keepStart`). `endsAt` blank means
 * no end; set, it must be after now and after the start.
 */
export function parseDeal(
  input: {
    title: unknown
    description: unknown
    code: unknown
    terms: unknown
    startsAt: unknown
    endsAt: unknown
  },
  now: Date,
  keepStart?: string | null
): ParsedDeal {
  const title = oneLine(input.title)
  if (!title) return { ok: false, error: 'Add a title for your deal.' }
  if (title.length > DEAL_TITLE_MAX) {
    return { ok: false, error: `Keep the title to ${DEAL_TITLE_MAX} characters or fewer.` }
  }
  const description = oneLine(input.description)
  if (description.length > DEAL_DESCRIPTION_MAX) {
    return {
      ok: false,
      error: `Keep the description to ${DEAL_DESCRIPTION_MAX} characters or fewer.`,
    }
  }
  const terms = oneLine(input.terms)
  if (terms.length > DEAL_TERMS_MAX) {
    return { ok: false, error: `Keep the terms to ${DEAL_TERMS_MAX} characters or fewer.` }
  }
  if (LINK_IN_TEXT.test(title) || LINK_IN_TEXT.test(description) || LINK_IN_TEXT.test(terms)) {
    return { ok: false, error: 'Leave links out of your deal.' }
  }

  const code = typeof input.code === 'string' ? input.code.trim() : ''
  if (code) {
    if (code.length > DEAL_CODE_MAX) {
      return { ok: false, error: `Keep the code to ${DEAL_CODE_MAX} characters or fewer.` }
    }
    if (!DEAL_CODE_RE.test(code)) {
      return {
        ok: false,
        error: 'Codes can use letters, numbers, dashes and underscores, with no spaces.',
      }
    }
  }

  const t = now.getTime()
  let start = parseTime(input.startsAt) ?? t
  const kept = keepStart ? parseTime(keepStart) : null
  if (start < t && start !== kept) start = t
  if (start > t + DEAL_MAX_LEAD_DAYS * DAY_MS) {
    return { ok: false, error: `A deal can start up to ${DEAL_MAX_LEAD_DAYS} days from now.` }
  }
  const hasEnd = typeof input.endsAt === 'string' && input.endsAt.trim() !== ''
  const end = hasEnd ? parseTime(input.endsAt) : null
  if (hasEnd && end === null) return { ok: false, error: 'Choose a valid end date.' }
  if (end !== null) {
    if (end <= t) return { ok: false, error: 'Choose an end date in the future.' }
    if (end <= start) return { ok: false, error: 'Your deal has to end after it starts.' }
  }

  return {
    ok: true,
    value: {
      title,
      description: description || null,
      code: code || null,
      terms: terms || null,
      starts_at: new Date(start).toISOString(),
      ends_at: end === null ? null : new Date(end).toISOString(),
    },
  }
}
