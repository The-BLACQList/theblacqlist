// Quick replies for owners (part H, 2026-11-13). Ready-made answers filled
// from the posting or page, plus the owner's saved replies. A chip only puts
// text in the reply box for the owner to edit; nothing here ever sends.
// Pure, so the templates are unit-tested (tests/messaging-postings.test.ts).

import type { WeeklyHours } from '@/types'
import { formatCloseDate, isRoleClosed } from '@/lib/listings/jobPosting'
import { MESSAGE_MAX_LENGTH, type SavedReplyKind } from './constants'
import { formatEventWhen } from './postings'

/** What a thread is about, for picking replies. */
export type ReplyKind = 'customer' | 'job' | 'event'

export interface QuickReply {
  id: string
  label: string
  text: string
}

export type QuickReplyContext =
  | {
      kind: 'job'
      title: string
      applyUrl: string | null
      applyEmail: string | null
      closesAt: string | null
    }
  | {
      kind: 'event'
      title: string
      startsAt: string | null
      timezone: string | null
      venueName: string | null
      isOnline: boolean
      ticketUrl: string | null
      pageUrl: string | null
    }
  | {
      kind: 'customer'
      businessName: string
      hours: WeeklyHours | null
      /** The page's main button, as words and a destination: "Book now" + a link, "Call us" + a number. */
      mainButton: { label: string; value: string } | null
    }

/**
 * The built-in replies for one thread. A reply whose detail is missing is left
 * out (no "apply here: " with nothing after it).
 */
export function buildQuickReplies(ctx: QuickReplyContext, now: Date = new Date()): QuickReply[] {
  const out: QuickReply[] = []
  if (ctx.kind === 'job') {
    const { title } = ctx
    if (ctx.applyUrl) {
      out.push({ id: 'job-apply', label: 'How to apply', text: `Thanks for your interest in the ${title} role! You can apply here: ${ctx.applyUrl}` })
    }
    if (ctx.applyEmail) {
      out.push({
        id: 'job-resume',
        label: 'Send your resume',
        text: `Thanks for reaching out about the ${title} role. Please send your resume to ${ctx.applyEmail} and we'll take a look.`,
      })
    }
    const closes = ctx.closesAt && !isRoleClosed(ctx.closesAt, now) ? formatCloseDate(ctx.closesAt, 'long') : null
    out.push({
      id: 'job-in-touch',
      label: "We'll be in touch",
      text: closes
        ? `Thanks for applying for the ${title} role. We're taking applications until ${closes} and will be in touch after that.`
        : `Thanks for applying for the ${title} role. We're reviewing applications and will be in touch soon.`,
    })
    out.push({
      id: 'job-filled',
      label: 'Role filled',
      text: `Thanks for your interest in the ${title} role. It has been filled, but we appreciate you reaching out.`,
    })
    return out
  }

  if (ctx.kind === 'event') {
    const { title } = ctx
    if (ctx.ticketUrl) {
      out.push({ id: 'event-tickets', label: 'Tickets', text: `You can get tickets for ${title} here: ${ctx.ticketUrl}` })
    }
    const when = formatEventWhen(ctx.startsAt, ctx.timezone)
    if (when) {
      const where = ctx.isOnline ? ' online' : ctx.venueName?.trim() ? ` at ${ctx.venueName.trim()}` : ''
      out.push({ id: 'event-still-on', label: 'Still on', text: `Yes, ${title} is still on: ${when}${where}. See you there!` })
    }
    out.push({
      id: 'event-sold-out',
      label: 'Sold out',
      text: `Thanks for your interest! ${title} is sold out right now. We'll let you know if spots open up.`,
    })
    if (ctx.pageUrl) {
      out.push({ id: 'event-details', label: 'Event details', text: `Here are all the details for ${title}: ${ctx.pageUrl}` })
    }
    return out
  }

  const hours = ctx.hours ? summarizeHours(ctx.hours) : null
  if (hours) out.push({ id: 'customer-hours', label: 'Our hours', text: `Our hours are ${hours}.` })
  if (ctx.mainButton) {
    out.push({ id: 'customer-main-button', label: ctx.mainButton.label, text: `${ctx.mainButton.label}: ${ctx.mainButton.value}` })
  }
  out.push({
    id: 'customer-thanks',
    label: 'Thanks',
    text: `Thanks for reaching out to ${ctx.businessName}! We'll get back to you soon.`,
  })
  return out
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
const DAY_SHORT: Record<(typeof DAY_ORDER)[number], string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
}

function shortTime(t: string): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return null
  const h = Number(m[1])
  if (h > 24) return null
  const suffix = h >= 12 && h < 24 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return m[2] === '00' ? `${h12}${suffix}` : `${h12}:${m[2]}${suffix}`
}

/**
 * "Mon–Fri 9am–5pm, Sat 10am–2pm, closed Sun". Days in a row with the same
 * hours are grouped. null when every day is closed or the hours are unusable.
 */
export function summarizeHours(hours: WeeklyHours): string | null {
  const spans: { from: string; to: string; text: string }[] = []
  for (const day of DAY_ORDER) {
    const h = hours[day]
    if (!h) return null
    let text: string
    if (h.closed) text = 'closed'
    else {
      const open = shortTime(h.open)
      const close = shortTime(h.close)
      if (!open || !close) return null
      text = `${open}–${close}`
    }
    const last = spans[spans.length - 1]
    if (last && last.text === text) last.to = DAY_SHORT[day]
    else spans.push({ from: DAY_SHORT[day], to: DAY_SHORT[day], text })
  }
  if (spans.every((s) => s.text === 'closed')) return null
  return spans
    .map((s) => {
      const days = s.from === s.to ? s.from : `${s.from}–${s.to}`
      return s.text === 'closed' ? `closed ${days}` : `${days} ${s.text}`
    })
    .join(', ')
}

/** What the owner's reply box offers: built-in chips, then their saved replies. */
export interface ReplyOptions {
  quick: QuickReply[]
  saved: { id: string; title: string; body: string }[]
  /** The thread's kind, the default for "Save as reply". */
  kind: ReplyKind
}

/** Saved replies that fit this thread: its own kind, plus "any". */
export function savedRepliesFor<T extends { kind: SavedReplyKind }>(replies: readonly T[], kind: ReplyKind): T[] {
  return replies.filter((r) => r.kind === 'any' || r.kind === kind)
}

/**
 * The reply box after a chip is picked: the text alone when the box is empty,
 * else added after what is already there. Never longer than a message can be.
 */
export function insertReply(current: string, text: string): string {
  const next = current.trim() ? `${current.trimEnd()}\n\n${text}` : text
  return next.slice(0, MESSAGE_MAX_LENGTH)
}
