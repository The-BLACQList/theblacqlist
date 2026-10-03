/**
 * The "Your place in The Collective" ego network on /account (ticket 114).
 *
 * Pure functions only: the page groups the signed-in user's own receipts, picks
 * the top businesses, and lays them out on a ring around a "You" dot. The SVG is
 * drawn on the server from these numbers, with no physics and no client JS.
 *
 * ── Own data only ───────────────────────────────────────────────────────────
 * Like `lib/spend/personal-spend.ts`, this runs over rows the caller has already
 * filtered to `user_id = <the signed-in user>`. The reader is the subject, so the
 * public 5-person cohort rule does not apply here. That also means nothing built
 * from this module may ever render on a public page.
 *
 * ── Approved only ───────────────────────────────────────────────────────────
 * Same rule as `buildTotals`: pending receipts are a count, never money. The
 * totals here must match /account/spending for the same user.
 */

export interface EgoReceipt {
  amount_cents: number
  status: string
  listing_id: string | null
}

export interface EgoBusinessSpend {
  listingId: string
  amountCents: number
  receiptCount: number
}

export interface EgoSpendSummary {
  /** Approved spend, matched and unmatched together. */
  totalCents: number
  /** Approved spend on receipts with no matched listing. */
  unmatchedCents: number
  /** Matched businesses, biggest spend first. */
  businesses: EgoBusinessSpend[]
  approvedReceiptCount: number
  pendingReceiptCount: number
}

/** Ring caps from the spec: 8 nodes on wide screens, 6 at 375px. */
export const EGO_MAX_NODES_WIDE = 8
export const EGO_MAX_NODES_NARROW = 6

/**
 * Group approved receipts by listing. Ties on amount sort by listing id so the
 * ring is stable between renders.
 */
export function summarizeEgoSpend(receipts: EgoReceipt[]): EgoSpendSummary {
  const byListing = new Map<string, EgoBusinessSpend>()
  let totalCents = 0
  let unmatchedCents = 0
  let approvedReceiptCount = 0
  let pendingReceiptCount = 0

  for (const receipt of receipts) {
    if (receipt.status === 'pending_review') {
      pendingReceiptCount += 1
      continue
    }
    if (receipt.status !== 'approved') continue

    const amount = receipt.amount_cents ?? 0
    approvedReceiptCount += 1
    totalCents += amount

    if (!receipt.listing_id) {
      unmatchedCents += amount
      continue
    }

    const existing = byListing.get(receipt.listing_id)
    if (existing) {
      existing.amountCents += amount
      existing.receiptCount += 1
    } else {
      byListing.set(receipt.listing_id, {
        listingId: receipt.listing_id,
        amountCents: amount,
        receiptCount: 1,
      })
    }
  }

  const businesses = Array.from(byListing.values()).sort(
    (a, b) => b.amountCents - a.amountCents || a.listingId.localeCompare(b.listingId)
  )

  return { totalCents, unmatchedCents, businesses, approvedReceiptCount, pendingReceiptCount }
}

export interface EgoNode {
  x: number
  y: number
  labelX: number
  labelY: number
  anchor: 'start' | 'middle' | 'end'
}

export interface EgoRing {
  width: number
  height: number
  cx: number
  cy: number
  /** Ellipse radii the nodes sit on. */
  rx: number
  ry: number
}

/** Wide frame matches the workshop board (440×240). */
export const EGO_RING_WIDE: EgoRing = { width: 440, height: 240, cx: 220, cy: 120, rx: 160, ry: 82 }
/** Narrow frame is taller and tighter, so 13px labels stay readable at 375px. */
export const EGO_RING_NARROW: EgoRing = { width: 320, height: 300, cx: 160, cy: 150, rx: 92, ry: 104 }

/**
 * Place `count` nodes evenly on the ring, starting at the top and going
 * clockwise. Labels sit outside the node: to the right on the right side, to the
 * left on the left side, and above or below near the top and bottom.
 */
export function layoutEgoRing(count: number, ring: EgoRing): EgoNode[] {
  if (count <= 0) return []
  const nodes: EgoNode[] = []
  for (let i = 0; i < count; i += 1) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const x = round(ring.cx + ring.rx * cos)
    const y = round(ring.cy + ring.ry * sin)

    let anchor: EgoNode['anchor']
    let labelX: number
    let labelY: number
    if (cos > 0.35) {
      anchor = 'start'
      labelX = x + 12
      labelY = y + 4
    } else if (cos < -0.35) {
      anchor = 'end'
      labelX = x - 12
      labelY = y + 4
    } else {
      anchor = 'middle'
      labelX = x
      labelY = sin < 0 ? y - 14 : y + 24
    }
    nodes.push({ x, y, labelX: round(labelX), labelY: round(labelY), anchor })
  }
  return nodes
}

/** Short node label: "{category} · ${amount}", with the category trimmed to fit. */
export function egoNodeLabel(category: string, amount: string, maxCategoryChars = 16): string {
  const trimmed =
    category.length > maxCategoryChars ? `${category.slice(0, maxCategoryChars - 1).trimEnd()}…` : category
  return `${trimmed} · ${amount}`
}

function round(n: number): number {
  return Math.round(n * 10) / 10
}
