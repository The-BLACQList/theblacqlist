import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowUpRight, TrendingUp, Building2, MapPin, Tag } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/ui/empty-state'

export const metadata: Metadata = {
  title: 'Community Spend | The BLACQList',
  description: 'See how much our community has spent at Black-owned businesses on The BLACQList.',
}

interface SpendNode {
  entity_id: string
  name: string
  total_amount_cents: number
  transaction_count: number
}

function formatDollars(cents: number) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

export default async function CommunitySpendPage() {
  const supabase = await createClient()

  // Total spend (excluding opt-outs). spend_events carries no PII and is
  // public-read by policy (`spend_events_public_select` in
  // 20260511000001_receipt_community_spend.sql) — same as flow_nodes. Mutations
  // are service-role only. So every figure on this page is a community
  // aggregate, not the signed-in user's own rows.
  const { data: spendRows } = await supabase
    .from('spend_events')
    .select('amount_cents, listing_id')
    .eq('aggregate_opt_out', false)

  const totalAmountCents = (spendRows ?? []).reduce((sum, r) => sum + r.amount_cents, 0)
  const totalTransactions = spendRows?.length ?? 0

  // Top businesses
  const { data: topBusinessNodes } = await supabase
    .from('flow_nodes')
    .select('entity_id, total_amount_cents, transaction_count')
    .eq('node_type', 'business')
    .order('total_amount_cents', { ascending: false })
    .limit(8)

  const businessIds = (topBusinessNodes ?? []).map((n) => n.entity_id)
  let businessNames: Record<string, { name: string; slug: string }> = {}
  if (businessIds.length > 0) {
    const { data: listings } = await supabase
      .from('listings')
      .select('id, name, slug')
      .in('id', businessIds)
    businessNames = Object.fromEntries(
      (listings ?? []).map((l) => [l.id, { name: l.name, slug: l.slug }])
    )
  }

  const topBusinesses: SpendNode[] = (topBusinessNodes ?? []).map((n) => ({
    entity_id: n.entity_id,
    name: businessNames[n.entity_id]?.name ?? 'Unknown Business',
    total_amount_cents: n.total_amount_cents,
    transaction_count: n.transaction_count,
  }))

  // Top cities
  const { data: topCityNodes } = await supabase
    .from('flow_nodes')
    .select('entity_id, total_amount_cents, transaction_count')
    .eq('node_type', 'city')
    .order('total_amount_cents', { ascending: false })
    .limit(8)

  const cityIds = (topCityNodes ?? []).map((n) => n.entity_id)
  let cityNames: Record<string, string> = {}
  if (cityIds.length > 0) {
    const { data: cities } = await supabase.from('cities').select('id, name').in('id', cityIds)
    cityNames = Object.fromEntries((cities ?? []).map((c) => [c.id, c.name]))
  }

  const topCities: SpendNode[] = (topCityNodes ?? []).map((n) => ({
    entity_id: n.entity_id,
    name: cityNames[n.entity_id] ?? 'Unknown City',
    total_amount_cents: n.total_amount_cents,
    transaction_count: n.transaction_count,
  }))

  // Top categories — computed at read time from spend_events -> listings.category_id
  // -> categories. There is no 'category' flow_node type (flow_nodes' CHECK permits
  // 'business' | 'city' only), and adding one would need a migration for a number
  // that a join already answers. Totals only: no user, no receipt, no listing named.
  const spentListingIds = Array.from(
    new Set((spendRows ?? []).map((r) => r.listing_id).filter((id): id is string => Boolean(id)))
  )

  let topCategories: SpendNode[] = []
  if (spentListingIds.length > 0) {
    const { data: listingCategories } = await supabase
      .from('listings')
      .select('id, category_id')
      .in('id', spentListingIds)

    const categoryByListing = new Map(
      (listingCategories ?? []).map((l) => [l.id, l.category_id as string])
    )

    const totals = new Map<string, { amount: number; count: number }>()
    for (const row of spendRows ?? []) {
      if (!row.listing_id) continue
      const categoryId = categoryByListing.get(row.listing_id)
      if (!categoryId) continue
      const current = totals.get(categoryId) ?? { amount: 0, count: 0 }
      totals.set(categoryId, {
        amount: current.amount + row.amount_cents,
        count: current.count + 1,
      })
    }

    if (totals.size > 0) {
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name')
        .in('id', Array.from(totals.keys()))

      const categoryNames = new Map((categories ?? []).map((c) => [c.id, c.name]))

      topCategories = Array.from(totals.entries())
        .map(([categoryId, t]) => ({
          entity_id: categoryId,
          name: categoryNames.get(categoryId) ?? 'Uncategorized',
          total_amount_cents: t.amount,
          transaction_count: t.count,
        }))
        .sort((a, b) => b.total_amount_cents - a.total_amount_cents)
        .slice(0, 8)
    }
  }

  const hasData = totalAmountCents > 0

  // A receipt only feeds the breakdowns when it was matched to a listing at
  // submission: approveReceipt creates flow nodes `if (spendEvent &&
  // receipt.listing_id)`, and the category rollup above needs the same id.
  // Money can therefore be counted in the total while every panel is empty —
  // which reads as a broken page unless we say so.
  const hasBreakdowns =
    topBusinesses.length > 0 || topCities.length > 0 || topCategories.length > 0

  return (
    <main>
      <div className="max-w-[720px] mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="font-headline text-3xl text-brand-black">Community spend</h1>
          <p className="font-subhead text-sm text-charcoal-soft mt-1 max-w-[480px]">
            Anonymized community data showing how BLACQList users are supporting Black-owned
            businesses. No personal data is attached to these totals.
          </p>
        </div>

        {/* Hero stat */}
        <div className="rounded-2xl bg-brand-black text-white p-8">
          {hasData ? (
            <>
              <p className="font-subhead text-sm text-white/50 font-semibold uppercase tracking-wide">
                Total community spend
              </p>
              <p className="font-headline text-5xl mt-2">{formatDollars(totalAmountCents)}</p>
              <p className="font-body text-sm text-white/50 mt-2">
                Across {totalTransactions} verified{' '}
                {totalTransactions === 1 ? 'receipt' : 'receipts'} submitted by our community
              </p>
            </>
          ) : (
            <>
              <p className="font-subhead text-sm text-white/50 font-semibold uppercase tracking-wide">
                Community spend tracker
              </p>
              <p className="font-headline text-3xl mt-2">Be the first to contribute</p>
              <p className="font-body text-sm text-white/50 mt-2">
                Submit a receipt from a Black-owned business to start building our community spend
                map.
              </p>
            </>
          )}
          <div className="mt-6">
            <Link
              href="/account/receipts/new"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
            >
              Submit a receipt
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {hasData && !hasBreakdowns && (
          <div className="rounded-xl bg-white border border-charcoal/10">
            <EmptyState
              icon={Building2}
              iconClassName="text-charcoal-faint"
              heading="No breakdowns yet"
              body="Spend breaks down by business, city, and category once an approved receipt is matched to a business on The BLACQList. A receipt that wasn't matched still counts toward the total above."
              action={{ label: 'View your receipts', href: '/account/receipts' }}
              className="py-10"
            />
          </div>
        )}

        {hasData && hasBreakdowns && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top businesses */}
            {topBusinesses.length > 0 && (
              <div className="rounded-xl bg-white border border-charcoal/10 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="size-4 text-amber" aria-hidden="true" />
                  <h2 className="font-headline text-base text-brand-black">Top businesses</h2>
                </div>
                <div className="space-y-3">
                  {topBusinesses.map((b, i) => (
                    <div key={b.entity_id} className="flex items-center gap-3">
                      <span className="font-subhead text-xs text-charcoal-faint w-5 text-right shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-subhead text-sm font-semibold text-brand-black truncate">
                          {b.name}
                        </p>
                        <p className="font-body text-xs text-charcoal-soft">
                          {b.transaction_count} {b.transaction_count === 1 ? 'receipt' : 'receipts'}
                        </p>
                      </div>
                      <span className="font-subhead text-sm font-semibold text-brand-black tabular-nums shrink-0">
                        {formatDollars(b.total_amount_cents)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top cities */}
            {topCities.length > 0 && (
              <div className="rounded-xl bg-white border border-charcoal/10 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="size-4 text-amber" aria-hidden="true" />
                  <h2 className="font-headline text-base text-brand-black">Top cities</h2>
                </div>
                <div className="space-y-3">
                  {topCities.map((c, i) => (
                    <div key={c.entity_id} className="flex items-center gap-3">
                      <span className="font-subhead text-xs text-charcoal-faint w-5 text-right shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-subhead text-sm font-semibold text-brand-black truncate">
                          {c.name}
                        </p>
                        <p className="font-body text-xs text-charcoal-soft">
                          {c.transaction_count} {c.transaction_count === 1 ? 'receipt' : 'receipts'}
                        </p>
                      </div>
                      <span className="font-subhead text-sm font-semibold text-brand-black tabular-nums shrink-0">
                        {formatDollars(c.total_amount_cents)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top categories */}
            {topCategories.length > 0 && (
              <div className="rounded-xl bg-white border border-charcoal/10 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Tag className="size-4 text-amber" aria-hidden="true" />
                  <h2 className="font-headline text-base text-brand-black">Top categories</h2>
                </div>
                <div className="space-y-3">
                  {topCategories.map((c, i) => (
                    <div key={c.entity_id} className="flex items-center gap-3">
                      <span className="font-subhead text-xs text-charcoal-faint w-5 text-right shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-subhead text-sm font-semibold text-brand-black truncate">
                          {c.name}
                        </p>
                        <p className="font-body text-xs text-charcoal-soft">
                          {c.transaction_count} {c.transaction_count === 1 ? 'receipt' : 'receipts'}
                        </p>
                      </div>
                      <span className="font-subhead text-sm font-semibold text-brand-black tabular-nums shrink-0">
                        {formatDollars(c.total_amount_cents)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Privacy note */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white border border-charcoal/10">
          <TrendingUp className="size-4 text-charcoal-faint shrink-0 mt-0.5" aria-hidden="true" />
          <p className="font-body text-xs text-charcoal-soft leading-relaxed">
            All totals are anonymized. Individual receipts are never shown publicly. Users who opt
            out are excluded from community totals.
          </p>
        </div>
      </div>
    </main>
  )
}
