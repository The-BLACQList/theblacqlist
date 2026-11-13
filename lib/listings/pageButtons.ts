import { VALID_CTA_TYPES } from '@/lib/constants/listing'
import { capList } from '@/lib/stripe/downgrade'
import { extraButtonLimit } from '@/lib/stripe/features'
import { getCtaLabel, type CTAType } from '@/types'

// Buttons on a page (owner-experience round 2, part B, 2026-11-13).
//
// A page has one main button (listing_details_business.cta_type) and, on paid
// plans, extra buttons (listing_buttons): Free 0, Starter 1, Growth 2, Premium 3.
// The automatic "Message" button (getSecondaryMessageHref) is neither, and
// never counts toward the limit.
//
// Which extras show: the first `extraButtonLimit(tier)` in position order, on
// the plan the page has now. This is stricter than the ticket 105 rule for
// other content (which trims only after a downgrade), on purpose: extra buttons
// exist only on paid plans, so a page that is not paying for them never shows
// them, however they got there. Nothing is deleted, and they show again on upgrade.
//
// Pure and client-safe: the public page read, the editor and the action share it.

/** The choices in the button pickers, in menu order. */
export const CTA_OPTIONS: { value: CTAType; label: string; requiresUrl: boolean }[] = [
  { value: 'book', label: 'Book an appointment', requiresUrl: true },
  { value: 'order', label: 'Order now', requiresUrl: true },
  { value: 'call', label: 'Call us', requiresUrl: false },
  { value: 'message', label: 'Message us (your inbox)', requiresUrl: false },
  { value: 'email', label: 'Email us', requiresUrl: true },
  { value: 'visit', label: 'Visit us', requiresUrl: true },
  { value: 'get-quote', label: 'Get a quote', requiresUrl: true },
  { value: 'shop', label: 'Shop now', requiresUrl: true },
  { value: 'subscribe', label: 'Subscribe', requiresUrl: true },
  { value: 'contact', label: 'Contact us', requiresUrl: true },
  { value: 'commission', label: 'Commission work', requiresUrl: true },
  { value: 'inquire', label: 'Inquire', requiresUrl: true },
  { value: 'get-tickets', label: 'Get tickets', requiresUrl: true },
  { value: 'rsvp', label: 'RSVP', requiresUrl: true },
  { value: 'register', label: 'Register', requiresUrl: true },
  { value: 'learn-more', label: 'Learn more', requiresUrl: true },
  { value: 'apply', label: 'Apply now', requiresUrl: true },
  { value: 'buy-now', label: 'Buy now', requiresUrl: true },
]

/**
 * Every button type except "Message us": the inbox already gets its own
 * automatic button, so an extra one would only repeat it. Must match the
 * listing_buttons.type CHECK (migration 20261115000000).
 */
export const EXTRA_BUTTON_TYPES = VALID_CTA_TYPES.filter(
  (t): t is Exclude<(typeof VALID_CTA_TYPES)[number], 'message'> => t !== 'message'
)

export type ExtraButtonType = (typeof EXTRA_BUTTON_TYPES)[number]

export const BUTTON_LABEL_MAX = 50
export const BUTTON_VALUE_MAX = 2048

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** One saved extra button. `value` is a link, an email address, or null for "Call us". */
export interface ExtraButton {
  id: string
  type: ExtraButtonType
  value: string | null
  label_override: string | null
  position: number
}

/** An extra button ready to render: where it goes and what it says. */
export interface PageButton {
  id: string
  href: string
  label: string
}

export function isExtraButtonType(value: unknown): value is ExtraButtonType {
  return typeof value === 'string' && (EXTRA_BUTTON_TYPES as readonly string[]).includes(value)
}

/** "Call us" uses the page's phone number, so it is the one type with no value. */
export function buttonTakesValue(type: string): boolean {
  return type !== 'call' && type !== 'message'
}

export type ParsedButton =
  | { ok: true; value: { type: ExtraButtonType; value: string | null; label_override: string | null } }
  | { ok: false; error: string }

/** Checks a new extra button. Same rules as the main button (updateCtaAction). */
export function parseExtraButton(type: unknown, value: unknown, label: unknown): ParsedButton {
  if (type === 'message') {
    return { ok: false, error: 'Your inbox already has its own Message button, so it can’t be an extra one.' }
  }
  if (!isExtraButtonType(type)) return { ok: false, error: 'Choose what the button does.' }

  const v = typeof value === 'string' ? value.trim() : ''
  const l = typeof label === 'string' ? label.trim() : ''

  if (l.length > BUTTON_LABEL_MAX) {
    return { ok: false, error: `Button label must be ${BUTTON_LABEL_MAX} characters or fewer.` }
  }
  if (!buttonTakesValue(type)) {
    return { ok: true, value: { type, value: null, label_override: l || null } }
  }
  if (!v) {
    return {
      ok: false,
      error: type === 'email' ? 'Enter the email address for this button.' : 'Enter the link for this button.',
    }
  }
  if (v.length > BUTTON_VALUE_MAX) return { ok: false, error: 'That link is too long.' }
  if (type === 'email') {
    if (!EMAIL_RE.test(v)) return { ok: false, error: 'Enter a valid email address.' }
  } else if (!/^https:\/\/\S+$/i.test(v)) {
    return { ok: false, error: 'The link must start with https://' }
  }
  return { ok: true, value: { type, value: v, label_override: l || null } }
}

/** Saved order: position, then the order they were added (the caller's input order). */
export function sortButtons<T extends { position: number }>(buttons: readonly T[]): T[] {
  return [...buttons].map((b, i) => ({ b, i })).sort((x, y) => x.b.position - y.b.position || x.i - y.i).map((x) => x.b)
}

/** Which extras the page shows on this plan, and which it keeps hidden. */
export function shownExtraButtons<T extends { position: number }>(
  buttons: readonly T[],
  tier: string | null | undefined
): { shown: T[]; hidden: T[] } {
  return capList(sortButtons(buttons), extraButtonLimit(tier ?? null))
}

/** Where an extra button goes, or null when it has nowhere to go (a call button with no phone). */
export function extraButtonHref(
  button: Pick<ExtraButton, 'type' | 'value'>,
  phone: string | null | undefined
): string | null {
  if (button.type === 'call') {
    const digits = (phone ?? '').replace(/\D/g, '')
    return digits ? `tel:${digits}` : null
  }
  const value = button.value?.trim()
  if (!value) return null
  if (button.type === 'email') return EMAIL_RE.test(value) ? `mailto:${value}` : null
  return /^https:\/\//i.test(value) ? value : null
}

export function extraButtonLabel(button: Pick<ExtraButton, 'type' | 'label_override'>): string {
  return getCtaLabel(button.type, button.label_override)
}

/**
 * The extras the public page renders: capped to the plan, in order, each with
 * a real destination. A button with nowhere to go is left out, never dead.
 */
export function resolvePageButtons(
  buttons: readonly ExtraButton[],
  tier: string | null | undefined,
  phone: string | null | undefined
): PageButton[] {
  const out: PageButton[] = []
  for (const b of shownExtraButtons(buttons, tier).shown) {
    const href = extraButtonHref(b, phone)
    if (href) out.push({ id: b.id, href, label: extraButtonLabel(b) })
  }
  return out
}

/** Reads rows from the database, dropping any with a type this code doesn't know. */
export function toExtraButtons(
  rows: readonly { id: string; type: string; value: string | null; label_override: string | null; position: number }[] | null
): ExtraButton[] {
  return (rows ?? []).flatMap((r) =>
    isExtraButtonType(r.type)
      ? [{ id: r.id, type: r.type, value: r.value, label_override: r.label_override, position: r.position }]
      : []
  )
}

/**
 * Moves one button up or down a place and returns the new order (ids). Null
 * when it can't move (already first or last, or not found).
 */
export function moveButton(
  buttons: readonly { id: string; position: number }[],
  id: string,
  direction: 'up' | 'down'
): string[] | null {
  const ids = sortButtons(buttons).map((b) => b.id)
  const i = ids.indexOf(id)
  const j = direction === 'up' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= ids.length) return null
  const a = ids[i]!
  ids[i] = ids[j]!
  ids[j] = a
  return ids
}
