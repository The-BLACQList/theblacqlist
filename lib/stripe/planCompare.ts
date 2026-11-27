import {
  activePostLimit,
  aiQuota,
  analyticsHistoryDays,
  attributeLimit,
  canAccess,
  descriptionCharLimit,
  documentLimit,
  eventLimit,
  extraButtonLimit,
  faqLimit,
  highlightLimit,
  jobLimit,
  locationLimit,
  photoLimit,
  productLimit,
  videoLimit,
  type GatedFeature,
} from '@/lib/stripe/features'
import type { PlanSlug } from '@/lib/stripe/plans'
import { isTierOpen, type PlanAvailability } from '@/lib/stripe/availability'

// Ticket 239 (founder, 2026-11-21): "When I'm looking at the plans side by
// side, I want it to be extremely clear how much more you're getting per tier
// upgrade." This is the full grid behind the cards on /pricing and Upgrade.
//
// Every cell is computed from lib/stripe/features.ts, the same limits and gates
// the code enforces, so the grid cannot promise more than a plan delivers.
// Add a row here only with the feature that makes it true (copy honesty rule,
// plan-features audit 2026-10-03).

export const COMPARE_TIERS: readonly PlanSlug[] = ['free', 'starter', 'growth', 'premium']

/** One cell. `up` marks a step up from the plan to its left. */
export type CompareCell =
  | { kind: 'yes'; up: boolean }
  | { kind: 'no' }
  | { kind: 'value'; text: string; up: boolean }

export interface CompareRow {
  label: string
  /** A short line under the label. */
  note?: string
  cells: Record<PlanSlug, CompareCell>
}

export interface CompareGroup {
  title: string
  rows: CompareRow[]
}

type Raw = boolean | number | null | string

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * A row from one value per plan. `fmt` prints a number. `null` is unlimited,
 * 0 and false are "not included". A cell is a step up when it beats the cell
 * to its left (more, unlimited where the left was capped, or newly included).
 * The Free column is the baseline and is never a step up.
 */
function row(
  label: string,
  value: (tier: PlanSlug) => Raw,
  fmt: (n: number) => string = (n) => String(n),
  note?: string
): CompareRow {
  const cells = {} as Record<PlanSlug, CompareCell>
  // Free has no plan to its left, so its cells are never marked as a step up.
  let prev: Raw | undefined
  for (const tier of COMPARE_TIERS) {
    const v = value(tier)
    cells[tier] = toCell(v, prev === undefined ? v : prev, fmt)
    prev = v
  }
  return { label, note, cells }
}

function rank(v: Raw): number {
  if (v === null) return Number.POSITIVE_INFINITY
  if (v === true) return 1
  if (v === false || v === 0) return 0
  if (typeof v === 'number') return v
  return 1
}

function toCell(v: Raw, prev: Raw, fmt: (n: number) => string): CompareCell {
  const up = rank(v) > rank(prev)
  if (v === false || v === 0) return { kind: 'no' }
  if (v === true) return { kind: 'yes', up }
  if (v === null) return { kind: 'value', text: 'No limit', up }
  if (typeof v === 'string') return { kind: 'value', text: v, up }
  return { kind: 'value', text: fmt(v), up }
}

const gate = (feature: GatedFeature) => (tier: PlanSlug) => canAccess(tier, feature)

/**
 * Every row, by group. With jobs closed (ticket 289, founder 2026-11-27: "We'll
 * take jobs off altogether") the job postings row goes and the two rows that
 * name jobs drop the word, the same as the plan cards (planFeatures).
 */
export function planCompareGroups(
  opts: { jobsOpen: boolean } = { jobsOpen: true }
): CompareGroup[] {
  const { jobsOpen } = opts
  return [
    {
      title: 'Your Page',
      rows: [
        row(
          'Full page layout',
          gate('chapters_layout'),
          undefined,
          'For businesses, restaurants, and vendors, once your page has a banner, 4 photos, and your story'
        ),
        row('Photos', photoLimit),
        row('Videos', videoLimit),
        row('Your story', (t) => {
          const chars = descriptionCharLimit(t)
          return chars === null ? null : `${chars} characters`
        }),
        row('Details customers filter by', attributeLimit),
        row('Common questions', faqLimit),
        row('Menu or service list, with prices', gate('service_menu_pricing')),
        row('Social links', gate('social_links')),
        row('Extra buttons next to your main one', extraButtonLimit),
        row('Downloadable PDFs, like your menu', documentLimit),
        row('Why choose us points', highlightLimit),
        row('Happening now posts at a time', activePostLimit),
      ],
    },
    {
      title: 'Map, Search, and Reviews',
      rows: [
        row('Category, city, and search placement', () => true),
        row('Map pin', () => true, undefined, 'Once your address is confirmed'),
        // Ticket 244: the look of the pin is paid; its order on the map is not.
        row(
          'Your logo as your map pin',
          gate('map_logo_pin'),
          undefined,
          'Where you sit on the map still comes from trust'
        ),
        row('Community reviews', () => true),
        row('Claim it and get Verified', () => true),
        row('Reply to reviews in public', gate('review_response')),
      ],
    },
    // Ticket 242 (founder, 2026-11-21): what AI helps with, by plan, then how
    // often. Each row reads the gate the agents behind it check.
    {
      title: 'AI Help',
      rows: [
        row('Page text and Instagram captions', gate('ai_suggestions')),
        row('Review replies and Happening Now posts', gate('ai_suggestions')),
        row('A monthly read of your numbers', gate('ai_suggestions')),
        row(
          jobsOpen
            ? 'Product, service, event, and job descriptions'
            : 'Product, service, and event descriptions',
          gate('ai_item_writeups')
        ),
        row('Times a month, per page', (t) => aiQuota(t) ?? null),
      ],
    },
    {
      title: 'Analytics',
      rows: [
        row(
          'Views, saves, and taps',
          (t) => analyticsHistoryDays(t),
          (d) => (d >= 365 ? '12 months' : count(d, 'day', 'days'))
        ),
        // Ticket 241. Storefront item numbers are not listed: they show only
        // while the marketplace is open, and a plan line has to be true today.
        row('Compared with the period before', gate('analytics_advanced')),
        row(
          jobsOpen ? 'Numbers for your events and jobs' : 'Numbers for your events',
          gate('analytics_advanced')
        ),
      ],
    },
    {
      title: jobsOpen ? 'Selling and Hiring' : 'Selling',
      rows: [
        row('Storefront products and services', (t) =>
          canAccess(t, 'storefront') ? productLimit(t) : false
        ),
        row('Events at a time', (t) => (canAccess(t, 'events') ? eventLimit(t) : false)),
        ...(jobsOpen
          ? [
              row(
                'Job postings every 30 days',
                jobLimit,
                (n) => String(n),
                'More can be bought on any plan'
              ),
            ]
          : []),
        row('Coupons and deals', gate('coupons')),
        row('Booking requests', gate('booking_requests')),
        row('Linked locations', (t) => (canAccess(t, 'multi_location') ? locationLimit(t) : false)),
        row('Community spend view', gate('spend_impact_panel')),
      ],
    },
    {
      // No "pages your plan covers" row: the cards carry it, and a Free cell
      // would have to say something about Free's pages, which the founder
      // ruled is never stated (ticket 238, 2026-11-21).
      title: 'Support',
      rows: [row('A named support contact', gate('dedicated_support'))],
    },
  ]
}

/**
 * The grid as one visitor sees it: a tier nobody can buy shows no values
 * (a closed tier lists nothing, plan-features audit 2026-10-03), and a row
 * that only a closed tier would fill is dropped, so it never reads as a
 * feature nobody has.
 */
export function visibleCompareGroups(
  open: Record<PlanSlug, boolean>,
  opts: { jobsOpen: boolean } = { jobsOpen: true }
): CompareGroup[] {
  return planCompareGroups(opts)
    .map((g) => ({
      ...g,
      rows: g.rows.filter((r) => COMPARE_TIERS.some((t) => open[t] && r.cells[t].kind !== 'no')),
    }))
    .filter((g) => g.rows.length > 0)
}

/**
 * Which columns show values: Free always, a paid tier when either cycle can be
 * bought, and the owner's own plan even if it has stopped selling (Upgrade
 * still shows a page what it has, as UpgradePlans does).
 */
export function compareOpen(
  availability: PlanAvailability,
  currentTier?: PlanSlug
): Record<PlanSlug, boolean> {
  const open = {} as Record<PlanSlug, boolean>
  for (const tier of COMPARE_TIERS) {
    open[tier] = tier === 'free' || tier === currentTier || isTierOpen(availability, tier)
  }
  return open
}
