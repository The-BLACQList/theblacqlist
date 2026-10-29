import { limitsFor, TIER_RANK } from '@/lib/stripe/features'

// Ticket 105. What a page shows after it moves to a lower plan.
//
// [Decision — founder, 2026-10-20] content over the new plan's limits is
// hidden on the public page, never deleted, and comes back on upgrade.
//
// "Moved to a lower plan" means the current tier ranks below listings.peak_tier,
// the highest paid tier the page has ever had (migration 20261020000000). So:
//   * a page that never paid (peak_tier null) is never trimmed, whatever the
//     platform loaded onto it;
//   * a page that is on its best plan so far never loses anything.
// Nothing changes in storage. The public read applies these caps, and the
// owner's editor marks what is hidden.
//
// Pure and client-safe: the public page read, the owner editor and the
// dashboard notice share it.

/** The limits that hide content after a downgrade. `null` means show everything. */
export interface ShownLimits {
  photos: number | null
  videos: number | null
  faqs: number | null
  attributes: number | null
  events: number | null
  descriptionChars: number | null
}

const NO_CAPS: ShownLimits = {
  photos: null,
  videos: null,
  faqs: null,
  attributes: null,
  events: null,
  descriptionChars: null,
}

function rank(tier: string | null | undefined): number {
  return TIER_RANK[tier ?? 'free'] ?? 0
}

/** True when the page is on a lower plan than one it has had before. */
export function isDowngraded(
  tier: string | null | undefined,
  peakTier: string | null | undefined
): boolean {
  return rank(tier) < rank(peakTier)
}

/** What the public page may show. All null unless the page has moved down a plan. */
export function shownLimits(
  tier: string | null | undefined,
  peakTier: string | null | undefined
): ShownLimits {
  if (!isDowngraded(tier, peakTier)) return NO_CAPS
  const l = limitsFor(tier ?? null)
  return {
    photos: l.photos,
    videos: l.videos,
    faqs: l.faqs,
    attributes: l.attributes,
    events: l.events,
    descriptionChars: l.descriptionChars,
  }
}

/** The first `limit` items show; the rest are hidden. Order is the caller's display order. */
export function capList<T>(items: readonly T[], limit: number | null): { shown: T[]; hidden: T[] } {
  if (limit === null || items.length <= limit) return { shown: [...items], hidden: [] }
  const n = Math.max(0, limit)
  return { shown: items.slice(0, n), hidden: items.slice(n) }
}

/**
 * The description as the page shows it: cut at the last word that fits, with
 * "…" after it. The full text stays saved.
 */
export function capDescription(text: string, limit: number | null): string {
  if (limit === null || text.length <= limit) return text
  if (limit <= 0) return ''
  const room = text.slice(0, Math.max(0, limit - 1))
  const lastSpace = room.search(/\s\S*$/)
  const cut = (lastSpace > 0 ? room.slice(0, lastSpace) : room).trimEnd()
  return `${cut}…`
}

/** One kind of content and how much of it is hidden. */
export interface HiddenCount {
  kind:
    | 'photos'
    | 'videos'
    | 'faqs'
    | 'attributes'
    | 'events'
    | 'products'
    | 'services'
    | 'description'
  hidden: number
  limit: number
}

const NOUNS: Record<Exclude<HiddenCount['kind'], 'description'>, [string, string]> = {
  photos: ['photo', 'photos'],
  videos: ['video', 'videos'],
  faqs: ['common question', 'common questions'],
  attributes: ['filter detail', 'filter details'],
  events: ['upcoming event', 'upcoming events'],
  products: ['product', 'products'],
  services: ['service', 'services'],
}

/**
 * One plain line per kind, for the owner: what is hidden and the plan's limit.
 * The lines never promise an upgrade. The notice adds one Growth link under them
 * when `offersGrowth` says so (ticket 143).
 */
export function hiddenLine(h: HiddenCount): string {
  if (h.kind === 'description') {
    return `Your page shows the first ${h.limit} characters of your description. The rest is saved.`
  }
  const [one, many] = NOUNS[h.kind]
  const noun = h.hidden === 1 ? one : many
  const verb = h.hidden === 1 ? 'is' : 'are'
  if (h.limit === 0) {
    // Products and services come with a storefront, which is how plans name it.
    const missing = h.kind === 'products' || h.kind === 'services' ? 'a storefront' : many
    return `${h.hidden} ${noun} ${verb} hidden on your page. Your plan doesn't include ${missing}.`
  }
  const cap = h.limit === 1 ? one : many
  return `${h.hidden} ${noun} ${verb} hidden on your page. Your plan shows up to ${h.limit} ${cap}.`
}

/**
 * Whether the hidden-content notice links to Growth: only while Growth can be
 * bought, and only for a page below it. Premium is not for sale, so a Growth
 * page gets no link.
 */
export function offersGrowth(tier: string | null | undefined, growthOpen: boolean): boolean {
  return growthOpen && rank(tier) < rank('growth')
}

export const HIDDEN_NOTICE_FOOTNOTE =
  'Nothing was deleted. Hidden items come back if your plan includes them again. Your page shows the first ones in each list, so removing one lets the next one show.'

/** Products and services are hidden all or nothing, so the list footnote does not fit. */
export const STOREFRONT_HIDDEN_FOOTNOTE =
  'Nothing was deleted. Your products and services show again if your plan includes a storefront again.'
