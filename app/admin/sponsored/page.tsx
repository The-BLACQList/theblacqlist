import Link from 'next/link'
import type { Metadata } from 'next'
import { Plus } from 'lucide-react'
import { requireAdmin } from '@/lib/admin/guard'
import { createClient } from '@/lib/supabase/server'

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

function PlacementTable({ items }: { items: PlacementRow[] }) {
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
                  className={`inline-block px-2 py-0.5 rounded-full font-subhead text-[11px] font-semibold capitalize ${statusClass(row.status)}`}
                >
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function statusClass(status: string) {
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

  const rows = (placements ?? []) as unknown as PlacementRow[]

  const active = rows.filter((r) => r.status === 'active')
  const scheduled = rows.filter((r) => r.status === 'scheduled')
  const ended = rows.filter(
    (r) => r.status === 'expired' || r.status === 'canceled' || r.status === 'inactive'
  )

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

      <section aria-labelledby="active-heading">
        <h2
          id="active-heading"
          className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-3"
        >
          Active ({active.length})
        </h2>
        <PlacementTable items={active} />
      </section>

      <section aria-labelledby="scheduled-heading">
        <h2
          id="scheduled-heading"
          className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-3"
        >
          Scheduled ({scheduled.length})
        </h2>
        <PlacementTable items={scheduled} />
      </section>

      <section aria-labelledby="ended-heading">
        <h2
          id="ended-heading"
          className="font-subhead text-xs font-semibold text-charcoal-soft uppercase tracking-wide mb-3"
        >
          Ended ({ended.length})
        </h2>
        <PlacementTable items={ended} />
      </section>
    </div>
  )
}
