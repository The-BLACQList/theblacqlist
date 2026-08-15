import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { requireAdmin } from '@/lib/admin/guard'
import { createClient } from '@/lib/supabase/server'
import {
  effectiveSponsoredStatus,
  isCancelable,
  SPONSORED_STATUS_LABEL,
  type SponsoredEffectiveStatus,
} from '@/lib/listings/sponsoredStatus'
import { CancelPlacementButton } from './CancelPlacementButton'

export const metadata: Metadata = { title: 'Sponsored Placements | Admin' }

type PlacementRow = {
  id: string
  position: number | null
  status: string
  starts_at: string | null
  ends_at: string | null
  listings: { id: string; name: string; slug: string } | null
  cities: { name: string } | null
  categories: { name: string } | null
}

type Delivery = { impressions: number; clicks: number }

/**
 * null means the delivery numbers could not be read at all — the RPC is
 * missing or errored. Those rows render "—", never "0". A zero here would be a
 * fabricated measurement: it reads as "we served this and nobody looked",
 * which is a very different thing to tell a sponsor than "we don't know yet".
 */
type DeliveryMap = Map<string, Delivery> | null

type Row = PlacementRow & { effective: SponsoredEffectiveStatus }

function PlacementTable({
  items,
  delivery,
  cancelable = false,
}: {
  items: Row[]
  delivery: DeliveryMap
  cancelable?: boolean
}) {
  if (items.length === 0) {
    return <p className="font-body text-sm text-charcoal-soft px-1 py-3">None</p>
  }
  return (
    <div className="rounded-xl border border-charcoal/10 overflow-hidden">
      <table className="w-full text-sm font-body" aria-label="Sponsored placements">
        <thead>
          <tr className="border-b border-charcoal/10 bg-pale-lavender/30 text-left">
            <th className="px-4 py-2.5 font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide">
              Listing
            </th>
            <th className="px-4 py-2.5 font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide">
              City
            </th>
            <th className="px-4 py-2.5 font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide">
              Category
            </th>
            <th className="px-4 py-2.5 font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide">
              Pos.
            </th>
            <th className="px-4 py-2.5 font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide">
              Dates
            </th>
            <th className="px-4 py-2.5 font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide">
              Status
            </th>
            <th className="px-4 py-2.5 font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide text-right">
              Impr.
            </th>
            <th className="px-4 py-2.5 font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide text-right">
              Clicks
            </th>
            {cancelable && (
              <th className="px-4 py-2.5 font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide text-right">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-charcoal/5">
          {items.map((row) => (
            <tr key={row.id} className="hover:bg-pale-lavender/20 transition-colors">
              <td className="px-4 py-3 text-brand-black font-medium">
                {row.listings?.name ?? '—'}
              </td>
              <td className="px-4 py-3 text-charcoal-soft">{row.cities?.name ?? 'All cities'}</td>
              <td className="px-4 py-3 text-charcoal-soft">
                {row.categories?.name ?? 'All categories'}
              </td>
              <td className="px-4 py-3 text-charcoal-soft">{row.position ?? '—'}</td>
              <td className="px-4 py-3 text-charcoal-soft text-xs whitespace-nowrap">
                {fmt(row.starts_at)} → {fmt(row.ends_at)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full font-subhead text-[11px] font-semibold ${statusClass(row.effective)}`}
                >
                  {SPONSORED_STATUS_LABEL[row.effective]}
                </span>
              </td>
              <td className="px-4 py-3 text-charcoal-soft text-right tabular-nums">
                {delivery ? (delivery.get(row.id)?.impressions ?? 0).toLocaleString() : '—'}
              </td>
              <td className="px-4 py-3 text-charcoal-soft text-right tabular-nums">
                {delivery ? (delivery.get(row.id)?.clicks ?? 0).toLocaleString() : '—'}
              </td>
              {cancelable && (
                <td className="px-4 py-3 text-right">
                  {isCancelable(row.effective) && (
                    <CancelPlacementButton
                      id={row.id}
                      listingName={row.listings?.name ?? 'this placement'}
                    />
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function statusClass(status: SponsoredEffectiveStatus) {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-700'
    case 'scheduled':
      return 'bg-blue-100 text-blue-700'
    case 'expired':
    case 'canceled':
      return 'bg-charcoal/10 text-charcoal-soft'
    default:
      return 'bg-charcoal/10 text-charcoal-soft'
  }
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function SponsoredPlacementsPage() {
  await requireAdmin()
  const supabase = await createClient()

  const { data: placements } = await supabase
    .from('sponsored_placements')
    .select(
      `
      id, position, status, starts_at, ends_at,
      listings!sponsored_placements_listing_id_fkey(id, name, slug),
      cities!sponsored_placements_city_id_fkey(name),
      categories!sponsored_placements_category_id_fkey(name)
    `
    )
    .order('starts_at', { ascending: false })
    .limit(100)

  const raw = (placements ?? []) as unknown as PlacementRow[]

  // Bucket on the DERIVED status, not the stored one. The stored value is
  // written once at creation and nothing ever moves it on, so a placement whose
  // ends_at passed months ago still says 'active' in the row. This table used to
  // report that verbatim while the delivery path had long since stopped serving
  // it. See lib/listings/sponsoredStatus.ts.
  const now = new Date()
  const rows: Row[] = raw.map((r) => ({ ...r, effective: effectiveSponsoredStatus(r, now) }))

  const active = rows.filter((r) => r.effective === 'active')
  const scheduled = rows.filter((r) => r.effective === 'scheduled')
  const ended = rows.filter(
    (r) =>
      r.effective === 'expired' || r.effective === 'canceled' || r.effective === 'inactive'
  )

  // Delivery counts. `delivery === null` is the honest "we could not read this"
  // state and renders "—"; it is what the page shows until the migration that
  // creates sponsored_placement_delivery has been applied to this environment.
  let delivery: DeliveryMap = null
  if (rows.length > 0) {
    // Not yet in the generated Database types — cast through any, same as the
    // other post-generation RPCs in app/admin/analytics.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: counts, error: deliveryError } = await (supabase as any).rpc(
      'sponsored_placement_delivery',
      { p_placement_ids: rows.map((r) => r.id) }
    )
    if (deliveryError) {
      console.error('[admin/sponsored] delivery counts unavailable', deliveryError)
    } else {
      const map = new Map<string, Delivery>()
      for (const c of (counts ?? []) as Array<{
        placement_id: string
        impressions: number | string
        clicks: number | string
      }>) {
        map.set(c.placement_id, {
          impressions: Number(c.impressions),
          clicks: Number(c.clicks),
        })
      }
      delivery = map
    }
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-headline text-2xl text-brand-black">Sponsored Placements</h1>
          <p className="font-body text-sm text-charcoal-soft mt-0.5">
            Manage paid listing placements injected into discover results.
          </p>
        </div>
        <Link
          href="/admin/sponsored/new"
          className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors shrink-0"
        >
          <Plus className="size-4" aria-hidden="true" />
          New placement
        </Link>
      </div>

      {rows.length > 0 && delivery === null && (
        <p
          className="font-body text-sm text-charcoal-soft rounded-lg border border-charcoal/10 bg-pale-lavender/30 px-4 py-3"
          role="status"
        >
          Delivery counts are unavailable in this environment. They read through{' '}
          <code className="font-mono text-xs">sponsored_placement_delivery</code>, added in
          migration <code className="font-mono text-xs">20260815000000</code>. Until that
          migration is applied here, impressions and clicks show as &ldquo;&mdash;&rdquo; rather
          than zero.
        </p>
      )}

      <section aria-labelledby="active-heading">
        <h2
          id="active-heading"
          className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-3"
        >
          Active ({active.length})
        </h2>
        <PlacementTable items={active} delivery={delivery} cancelable />
      </section>

      <section aria-labelledby="scheduled-heading">
        <h2
          id="scheduled-heading"
          className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-3"
        >
          Scheduled ({scheduled.length})
        </h2>
        <PlacementTable items={scheduled} delivery={delivery} cancelable />
      </section>

      <section aria-labelledby="ended-heading">
        <h2
          id="ended-heading"
          className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-3"
        >
          Ended ({ended.length})
        </h2>
        <PlacementTable items={ended} delivery={delivery} />
      </section>
    </div>
  )
}
