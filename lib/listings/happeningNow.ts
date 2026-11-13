import { capList } from '@/lib/stripe/downgrade'
import { activePostLimit } from '@/lib/stripe/features'

// =============================================================================
// Happening now posts (owner-experience round 2, part F, 2026-11-13)
// =============================================================================
// A short, dated post at the top of a business page and in the "Happening now"
// strip on city and category pages (listing_posts, migration 20261116000000).
//
// When a post shows: status 'active' and now inside [starts_at, ends_at).
// Visibility is decided here and in RLS when the post is read, so nothing has
// to run when a post ends.
//
// How many show: the first `activePostLimit(tier)` live posts by creation
// order, on the plan the page has now. Like extra buttons (part B), and on
// purpose stricter than the ticket 105 rule: posts exist only on paid plans, so
// a page not paying for them never shows them. Nothing is deleted, and they
// show again on upgrade.
//
// Pure and client-safe: the page read, the strip, the actions and the editor
// share it.
// =============================================================================

export const POST_HEADLINE_MAX = 80
export const POST_BODY_MAX = 200
export const POST_BUTTON_LABEL_MAX = 30
export const POST_URL_MAX = 2048
/** The longest a post runs. Matches listing_posts_window_check. */
export const POST_MAX_DAYS = 30
/** How far ahead a post can be scheduled. */
export const POST_MAX_LEAD_DAYS = 60
/** Posts in the city and category strip. */
export const STRIP_LIMIT = 8
/** The button's words when the owner leaves them blank. */
export const DEFAULT_POST_BUTTON = 'Learn more'

const DAY_MS = 24 * 60 * 60 * 1000

export type PostStatus = 'draft' | 'active' | 'ended'

/** Where a post is now, from the owner's side. */
export type PostState = 'draft' | 'scheduled' | 'live' | 'ended'

/** One saved post, as the owner sees it. Times are ISO strings. */
export interface OwnerPost {
  id: string
  headline: string
  body: string | null
  image_path: string | null
  button_label: string | null
  button_url: string | null
  starts_at: string
  ends_at: string
  status: PostStatus
  created_at: string
}

/** A post ready for the public page or the strip. */
export interface PublicPost {
  id: string
  headline: string
  body: string | null
  imageUrl: string | null
  /** The button's words, or null when the post has no button. */
  buttonLabel: string | null
  endsAt: string
}

type Timed = Pick<OwnerPost, 'status' | 'starts_at' | 'ends_at'>

function ms(iso: string): number {
  const t = Date.parse(iso)
  return Number.isFinite(t) ? t : Number.NaN
}

export function postState(post: Timed, now: Date): PostState {
  if (post.status === 'draft') return 'draft'
  const t = now.getTime()
  if (post.status === 'ended' || !(ms(post.ends_at) > t)) return 'ended'
  return ms(post.starts_at) <= t ? 'live' : 'scheduled'
}

/** Showing to the public right now (before the plan's cap). */
export function isLive(post: Timed, now: Date): boolean {
  return postState(post, now) === 'live'
}

/** On, live or scheduled: what the plan's limit counts. */
export function countsTowardLimit(post: Timed, now: Date): boolean {
  const state = postState(post, now)
  return state === 'live' || state === 'scheduled'
}

/**
 * Which posts the page shows on this plan, and which live ones it keeps
 * hidden. The cap keeps the oldest posts; the shown ones come back soonest
 * ending first.
 */
export function shownPosts<T extends Timed & Pick<OwnerPost, 'created_at'>>(
  posts: readonly T[],
  tier: string | null | undefined,
  now: Date
): { shown: T[]; hidden: T[] } {
  const live = posts
    .filter((p) => isLive(p, now))
    .sort((a, b) => ms(a.created_at) - ms(b.created_at))
  const { shown, hidden } = capList(live, activePostLimit(tier ?? null))
  return { shown: [...shown].sort((a, b) => ms(a.ends_at) - ms(b.ends_at)), hidden }
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

/** True for an image the owner uploaded for this listing's posts. */
export function isUploadedPostImagePath(listingId: string, path: string | null | undefined): boolean {
  if (!path || !new RegExp(`^${UUID}$`, 'i').test(listingId)) return false
  return new RegExp(`^listings/${listingId}/post/${UUID}\\.(jpg|png|webp)$`, 'i').test(path)
}

/** The link a post's button or strip card goes through, so the click is counted. */
export function postClickHref(postId: string, from: 'page' | 'strip'): string {
  return `/api/happening-now/${encodeURIComponent(postId)}?from=${from}`
}

/**
 * "Ends in 3 hours", "Ends tomorrow", "Ends in 5 days". Counted from now, not
 * by calendar date, so the server's time zone never shifts it a day.
 */
export function endsLabel(endsAt: string, now: Date): string {
  const left = ms(endsAt) - now.getTime()
  if (!Number.isFinite(left) || left <= 0) return 'Ended'
  const hours = Math.ceil(left / (60 * 60 * 1000))
  if (hours <= 1) return 'Ends within the hour'
  if (hours < 24) return `Ends in ${hours} hours`
  const days = Math.round(left / DAY_MS)
  return days <= 1 ? 'Ends tomorrow' : `Ends in ${days} days`
}

const STATUSES: readonly PostStatus[] = ['draft', 'active', 'ended']

/** Rows from listing_posts, with anything malformed left out. */
export function toOwnerPosts(rows: unknown): OwnerPost[] {
  if (!Array.isArray(rows)) return []
  return rows.flatMap((r): OwnerPost[] => {
    const row = r as Partial<OwnerPost> | null
    if (!row || typeof row.id !== 'string' || typeof row.headline !== 'string') return []
    if (typeof row.starts_at !== 'string' || typeof row.ends_at !== 'string') return []
    if (!STATUSES.includes(row.status as PostStatus)) return []
    return [
      {
        id: row.id,
        headline: row.headline,
        body: row.body ?? null,
        image_path: row.image_path ?? null,
        button_label: row.button_label ?? null,
        button_url: row.button_url ?? null,
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        status: row.status as PostStatus,
        created_at: typeof row.created_at === 'string' ? row.created_at : row.starts_at,
      },
    ]
  })
}

/** A post for the public page. `imageUrl` turns a storage path into a link. */
export function toPublicPost(post: OwnerPost, imageUrl: (path: string) => string | null): PublicPost {
  return {
    id: post.id,
    headline: post.headline,
    body: post.body,
    imageUrl: post.image_path ? imageUrl(post.image_path) : null,
    buttonLabel: post.button_url ? post.button_label || DEFAULT_POST_BUTTON : null,
    endsAt: post.ends_at,
  }
}

// ── Checking what the owner wrote ───────────────────────────────────────────

/** The fields a post saves, checked. */
export interface PostFields {
  headline: string
  body: string | null
  button_label: string | null
  button_url: string | null
  starts_at: string
  ends_at: string
}

export type ParsedPost = { ok: true; value: PostFields } | { ok: false; error: string }

// Links go in the button, so the text stays readable and isn't a way around it.
const LINK_IN_TEXT = /https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|co|io|biz|info|shop|store|link|ly)\b/i
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
 * Checks a post. `startsAt` blank or in the past means now, except a post
 * already running keeps the start it has (`keepStart`). `endsAt` must be after
 * now and within 30 days of the start; an end a few minutes past 30 days (the
 * start moved to now on the server) is pulled back to exactly 30 days.
 */
export function parsePost(
  input: {
    headline: unknown
    body: unknown
    buttonLabel: unknown
    buttonUrl: unknown
    startsAt: unknown
    endsAt: unknown
  },
  now: Date,
  keepStart?: string | null
): ParsedPost {
  const headline = oneLine(input.headline)
  if (!headline) return { ok: false, error: 'Add a headline.' }
  if (headline.length > POST_HEADLINE_MAX) {
    return { ok: false, error: `Keep the headline to ${POST_HEADLINE_MAX} characters or fewer.` }
  }
  const body = oneLine(input.body)
  if (body.length > POST_BODY_MAX) {
    return { ok: false, error: `Keep the text to ${POST_BODY_MAX} characters or fewer.` }
  }
  if (LINK_IN_TEXT.test(headline) || LINK_IN_TEXT.test(body)) {
    return { ok: false, error: 'Put links in the button, not in the text.' }
  }

  const buttonUrl = typeof input.buttonUrl === 'string' ? input.buttonUrl.trim() : ''
  const buttonLabel = oneLine(input.buttonLabel)
  if (buttonLabel && !buttonUrl) return { ok: false, error: 'Add the link for your button, or clear its words.' }
  if (buttonLabel.length > POST_BUTTON_LABEL_MAX) {
    return { ok: false, error: `Keep the button to ${POST_BUTTON_LABEL_MAX} characters or fewer.` }
  }
  if (buttonUrl) {
    if (buttonUrl.length > POST_URL_MAX) return { ok: false, error: 'That link is too long.' }
    if (!/^https:\/\/[^\s/]+\.[^\s]+$/i.test(buttonUrl)) {
      return { ok: false, error: 'The button link must start with https://' }
    }
  }

  const t = now.getTime()
  const end = parseTime(input.endsAt)
  if (end === null) return { ok: false, error: 'Choose when your post ends.' }
  let start = parseTime(input.startsAt) ?? t
  const kept = keepStart ? parseTime(keepStart) : null
  if (start < t && start !== kept) start = t
  if (start > t + POST_MAX_LEAD_DAYS * DAY_MS) {
    return { ok: false, error: `A post can start up to ${POST_MAX_LEAD_DAYS} days from now.` }
  }
  if (end <= t) return { ok: false, error: 'Choose an end time in the future.' }
  if (end <= start) return { ok: false, error: 'Your post has to end after it starts.' }
  const maxEnd = start + POST_MAX_DAYS * DAY_MS
  let endAt = end
  if (end > maxEnd) {
    if (end - maxEnd > 60 * 60 * 1000) {
      return { ok: false, error: `A post can run for up to ${POST_MAX_DAYS} days.` }
    }
    endAt = maxEnd
  }

  return {
    ok: true,
    value: {
      headline,
      body: body || null,
      button_label: buttonUrl ? buttonLabel || null : null,
      button_url: buttonUrl || null,
      starts_at: new Date(start).toISOString(),
      ends_at: new Date(endAt).toISOString(),
    },
  }
}
