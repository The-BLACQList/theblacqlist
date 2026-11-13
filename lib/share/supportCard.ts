// =============================================================================
// The support post: who sees it, and what it says (ticket 183)
// =============================================================================
// /account/receipts/[id]/share lets a shopper post that they supported a
// business. Pure helpers only, so the privacy rules can be tested without a
// page or a canvas:
//   * No amount, ever, and never the receipt. The page doesn't even read them.
//   * Only a receipt for a business on The BLACQList has a post. An unmatched
//     receipt waits for the business to join (lib/spend/unlisted.ts) and gets
//     the invite instead, so nothing we brand names a business we haven't
//     listed. `[Decision — founder, 2026-11-13]`
//   * The business is always named, and the post links to its page.
//     `[Decision — founder, 2026-11-13]` "The support card should always name
//     the business." This replaces the earlier opt-in rule for support posts;
//     the counted screen's text share (ticket 166) still follows the opt-in.
//   * "Verified" only when the receipt is approved.
//   * "Collective Member" only when the receipt will be on the map.
// `[Decision — founder, 2026-11-13]`
// =============================================================================

import { supportCaption, type SupportStage } from '@/lib/share/captions'
import { buildEntityUrl } from '@/lib/listings/url'

export type SupportScreen = 'show' | 'not_found' | 'redirect' | 'error'

/** What the share page reads. Deliberately no amount and no file path. */
export interface SupportReceipt {
  user_id: string
  status: string
  purchase_date: string | null
  listing_id: string | null
  aggregate_opt_out: boolean
  listings: SupportListing | null
}

export interface SupportListing {
  name: string
  slug: string
  entity_type: string
  cities: { name: string; state_abbr: string | null; slug: string } | null
}

/**
 * The stage a receipt's status allows. A waiting receipt is "supported", an
 * approved one is "verified", and anything else (needs a fix) has no post.
 */
export function supportStage(status: string): SupportStage | null {
  if (status === 'pending_review') return 'supported'
  if (status === 'approved') return 'verified'
  return null
}

/**
 * What the page does for this viewer. Same rules as the counted screen: a
 * failed read is the error state, someone else's receipt is a 404 (never a
 * 403), and a receipt with no post goes back to My receipts: one that needs a
 * fix, or one for a business that isn't on The BLACQList.
 */
export function supportScreen(args: {
  readFailed: boolean
  receipt: Pick<SupportReceipt, 'user_id' | 'status' | 'listing_id'> | null
  viewerId: string
}): SupportScreen {
  if (args.readFailed) return 'error'
  if (!args.receipt || args.receipt.user_id !== args.viewerId) return 'not_found'
  if (!supportStage(args.receipt.status) || !args.receipt.listing_id) return 'redirect'
  return 'show'
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-11-13" → "Nov 13, 2026". Read as a calendar date, so no timezone shift. */
export function supportDateLabel(purchaseDate: string | null): string | null {
  const m = purchaseDate?.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const month = MONTHS[Number(m[2]) - 1]
  if (!month) return null
  return `${month} ${Number(m[3])}, ${m[1]}`
}

export interface SupportPost {
  stage: SupportStage
  /** The business name. */
  businessLabel: string
  /** "Atlanta, GA", or null when there's no city. */
  cityLabel: string | null
  /** "Nov 13, 2026", or null for a missing date. */
  dateLabel: string | null
  /** The receipt joins the map, so the card may say "Collective Member". */
  collective: boolean
  /** Absolute link the post carries: the business page. */
  url: string
  caption: string
  /** For analytics. */
  listingId: string
}

export function buildSupportPost(args: {
  origin: string
  receipt: SupportReceipt
}): SupportPost | null {
  const { receipt } = args
  const stage = supportStage(receipt.status)
  const listing = receipt.listings
  const businessLabel = listing?.name.trim() ?? ''
  // No listing, no post: only businesses on The BLACQList are named.
  if (!stage || !receipt.listing_id || !listing || !businessLabel) return null

  const origin = args.origin.replace(/\/+$/, '')
  const city = listing.cities
  const cityLabel = city
    ? [city.name.trim(), city.state_abbr?.trim()].filter(Boolean).join(', ') || null
    : null
  const collective = !receipt.aggregate_opt_out
  const path = buildEntityUrl(listing.entity_type, city?.slug, listing.slug)

  return {
    stage,
    businessLabel,
    cityLabel,
    dateLabel: supportDateLabel(receipt.purchase_date),
    collective,
    url: `${origin}${path}`,
    caption: supportCaption({ businessName: businessLabel, stage, collective }),
    listingId: receipt.listing_id,
  }
}

export function supportShareHref(receiptId: string, opts?: { isNew?: boolean }): string {
  return `/account/receipts/${receiptId}/share${opts?.isNew ? '?new=1' : ''}`
}
