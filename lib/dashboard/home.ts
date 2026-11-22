// Business Home (ticket 253). The founder, 2026-11-21: "The home page feels
// useless since I'm switching between pages in the left panel. Make it more
// useful to a business owner at first glance." Home now answers three things
// for the page picked in the menu: what needs me, how am I doing, and what
// should I do next. Pure helpers here; the reads are in homeData.ts.

export interface NeedsYouInput {
  pageId: string
  /** Unread messages. Undefined when messaging is off. */
  messagesUnread?: number
  /** Receipts waiting for this owner. Undefined when the feature is off. */
  receiptsToVerify?: number
  /** Published reviews on this page with no reply yet. */
  reviewsToAnswer: number
  /** The page's public address, for review replies (owners reply on the page). */
  publicUrl: string | null
  /** 'pending' while staff review a new page. */
  status: string | null
}

export interface NeedsYouItem {
  key: 'review' | 'messages' | 'receipts' | 'reviews'
  label: string
  detail: string
  href: string
  count?: number
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Only things with work waiting. An empty list means all caught up. */
export function needsYouItems(input: NeedsYouInput): NeedsYouItem[] {
  const items: NeedsYouItem[] = []
  if (input.status === 'pending') {
    items.push({
      key: 'review',
      label: 'Your Page Is in Review',
      detail: 'Our team checks every new page. You can keep editing while you wait.',
      href: `/dashboard/pages/${input.pageId}/edit`,
    })
  }
  if (input.messagesUnread && input.messagesUnread > 0) {
    items.push({
      key: 'messages',
      label: 'Answer Messages',
      detail: `${plural(input.messagesUnread, 'message', 'messages')} waiting for a reply.`,
      href: '/dashboard/messages',
      count: input.messagesUnread,
    })
  }
  if (input.reviewsToAnswer > 0 && input.publicUrl) {
    items.push({
      key: 'reviews',
      label: 'Reply to Reviews',
      detail: `${plural(input.reviewsToAnswer, 'review has', 'reviews have')} no reply yet.`,
      href: `${input.publicUrl}#reviews-heading`,
      count: input.reviewsToAnswer,
    })
  }
  if (input.receiptsToVerify && input.receiptsToVerify > 0) {
    items.push({
      key: 'receipts',
      label: 'Verify Receipts',
      detail: `${plural(input.receiptsToVerify, 'customer is', 'customers are')} waiting for you to confirm a purchase.`,
      href: '/dashboard/receipts',
      count: input.receiptsToVerify,
    })
  }
  return items
}

export interface ChecklistInput {
  cover: boolean
  tagline: boolean
  description: boolean
  contact: boolean
  cta: boolean
  seoTitle: boolean
}

export interface ChecklistItem {
  key: keyof ChecklistInput
  label: string
  done: boolean
}

/**
 * The page checklist the old home showed per page. Cover leads: it changes how
 * the business looks everywhere else on the site.
 */
export function pageChecklist(input: ChecklistInput): ChecklistItem[] {
  return [
    { key: 'cover', label: 'Add a Cover Photo', done: input.cover },
    { key: 'tagline', label: 'Write a Tagline', done: input.tagline },
    { key: 'description', label: 'Describe Your Business', done: input.description },
    { key: 'contact', label: 'Add a Phone or Website', done: input.contact },
    { key: 'cta', label: 'Choose Your Main Button', done: input.cta },
    { key: 'seoTitle', label: 'Set a Search Title', done: input.seoTitle },
  ]
}

/** Title Case status words for the header chip. */
export function statusLabel(status: string | null): string {
  if (status === 'published') return 'Live'
  if (status === 'pending') return 'In Review'
  if (!status) return 'Draft'
  return status
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export interface DailyCounts {
  snapshot_date: string
  page_views: number | null
  cta_clicks: number | null
  saves: number | null
}

export interface DailySeries {
  views: number[]
  taps: number[]
  saves: number[]
}

/**
 * One value per day for the last `days` days, oldest first, ending today
 * (UTC). The nightly rollup skips days with nothing, so missing days are 0.
 */
export function dailySeries(rows: readonly DailyCounts[], days: number, now: Date): DailySeries {
  const byDate = new Map(rows.map((r) => [r.snapshot_date, r]))
  const out: DailySeries = { views: [], taps: [], saves: [] }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  for (let i = days - 1; i >= 0; i--) {
    const key = new Date(today - i * 86_400_000).toISOString().slice(0, 10)
    const row = byDate.get(key)
    out.views.push(row?.page_views ?? 0)
    out.taps.push(row?.cta_clicks ?? 0)
    out.saves.push(row?.saves ?? 0)
  }
  return out
}

/** SVG polyline points in a 100 x 32 box. Null when every value is 0. */
export function sparkPoints(values: readonly number[]): string | null {
  const max = Math.max(0, ...values)
  if (values.length < 2 || max === 0) return null
  const step = 100 / (values.length - 1)
  return values
    .map((v, i) => `${(i * step).toFixed(2)},${(30 - (v / max) * 28).toFixed(2)}`)
    .join(' ')
}

/** Whole-number display: 1,234 and 12.3K past 10,000. */
export function formatCount(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}K`
  return n.toLocaleString('en-US')
}
