/**
 * Ticket 242: the facts one AI help request writes about, when it writes about
 * one thing on the page rather than the page itself: a review to reply to, a
 * Happening Now post, a product or service, an event, a job.
 *
 * Where each one comes from:
 *
 * - **review**: loaded on the server from the review id, after checking the
 *   review is on the owner's page. Only the star rating and the review's text
 *   go in a prompt. Never the reviewer's name or account.
 * - **post, offering, event, job**: what the owner has typed into the form so
 *   far, which may not be saved yet. It is the owner's own text, so it is
 *   treated like the About text: capped, contact details and street addresses
 *   taken out, the owner's name taken out.
 *
 * Every value is cleaned in `itemPromptVars` before it reaches a prompt, the
 * same way `buildPromptVars` cleans the page's own fields. No server imports,
 * so the client forms can share the types and `parseItemFacts`.
 */

export type ItemKind = 'review' | 'post' | 'offering' | 'event' | 'job'

export type ItemFacts =
  | { kind: 'review'; rating: number; text: string }
  | { kind: 'post'; notes: string }
  | {
      kind: 'offering'
      offeringType: 'product' | 'service'
      name: string
      notes: string | null
      price: string | null
    }
  | { kind: 'event'; name: string; when: string | null; where: string | null; notes: string | null }
  | {
      kind: 'job'
      title: string
      employmentType: string | null
      workplaceType: string | null
      pay: string | null
      notes: string | null
    }

/** What the browser may send. A review is named by id only; its text is loaded on the server. */
export type ItemInput = { kind: 'review'; reviewId: string } | Exclude<ItemFacts, { kind: 'review' }>

/** Longest text of each kind that may enter a prompt. */
export const ITEM_LIMITS = {
  name: 120,
  short: 80,
  notes: 600,
  reviewText: 1500,
} as const

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Checks what the browser sent and keeps only the known fields, trimmed to
 * their caps. Null when it is not usable: a wrong kind, a missing name, a post
 * with nothing to go on.
 */
export function parseItemInput(raw: unknown): ItemInput | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  switch (r.kind) {
    case 'review': {
      const reviewId = typeof r.reviewId === 'string' && UUID.test(r.reviewId) ? r.reviewId : null
      return reviewId ? { kind: 'review', reviewId } : null
    }
    case 'post': {
      const notes = text(r.notes, ITEM_LIMITS.notes)
      return notes ? { kind: 'post', notes } : null
    }
    case 'offering': {
      const name = text(r.name, ITEM_LIMITS.name)
      if (!name || (r.offeringType !== 'product' && r.offeringType !== 'service')) return null
      return {
        kind: 'offering',
        offeringType: r.offeringType,
        name,
        notes: text(r.notes, ITEM_LIMITS.notes),
        price: text(r.price, ITEM_LIMITS.short),
      }
    }
    case 'event': {
      const name = text(r.name, ITEM_LIMITS.name)
      if (!name) return null
      return {
        kind: 'event',
        name,
        when: text(r.when, ITEM_LIMITS.short),
        where: text(r.where, ITEM_LIMITS.name),
        notes: text(r.notes, ITEM_LIMITS.notes),
      }
    }
    case 'job': {
      const title = text(r.title, ITEM_LIMITS.name)
      if (!title) return null
      return {
        kind: 'job',
        title,
        employmentType: text(r.employmentType, ITEM_LIMITS.short),
        workplaceType: text(r.workplaceType, ITEM_LIMITS.short),
        pay: text(r.pay, ITEM_LIMITS.short),
        notes: text(r.notes, ITEM_LIMITS.notes),
      }
    }
    default:
      return null
  }
}

/** Clamps a star rating to a whole number from 1 to 5. */
export function clampRating(rating: number): number {
  if (!Number.isFinite(rating)) return 3
  return Math.min(5, Math.max(1, Math.round(rating)))
}

/**
 * The lines of facts a prompt shows, before cleaning. The provider cleans each
 * value with `sanitizeForPrompt` (lib/ai/provider.ts `buildPromptVars`), so
 * this only decides labels and order. Empty values are left out, never sent as
 * "none".
 */
export function itemFactLines(item: Exclude<ItemFacts, { kind: 'review' }>): Array<[string, string]> {
  const lines: Array<[string, string | null]> = (() => {
    switch (item.kind) {
      case 'post':
        return [["What the owner wants to say", item.notes]]
      case 'offering':
        return [
          [item.offeringType === 'product' ? 'Product' : 'Service', item.name],
          ['Price', item.price],
          ["Owner's notes", item.notes],
        ]
      case 'event':
        return [
          ['Event', item.name],
          ['When', item.when],
          ['Where', item.where],
          ["Owner's notes", item.notes],
        ]
      case 'job':
        return [
          ['Job title', item.title],
          ['Type', item.employmentType],
          ['Workplace', item.workplaceType],
          ['Pay', item.pay],
          ["Owner's notes", item.notes],
        ]
    }
  })()
  return lines.filter((l): l is [string, string] => Boolean(l[1]))
}
