import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowUpRight, Lock, Building2 } from 'lucide-react'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { buildEntityUrl } from '@/lib/listings/url'
import { AGGREGATE_MIN_TRANSACTIONS } from '@/lib/spend/aggregate-privacy'
import { FlowSummaryCards } from '@/components/flow-map/FlowSummaryCards'
import { FlowNodeTable } from '@/components/flow-map/FlowNodeTable'
import { FlowMapNetwork } from '@/components/flow-map/FlowMapNetwork'
import { FlowMapFilters } from '@/components/flow-map/FlowMapFilters'

export const metadata: Metadata = {
  title: 'Community Dollar Flow | The BLACQList',
  description:
    'See how the BLACQList community is directing dollars to Black-owned businesses. All data is anonymized. No buyer identities exposed.',
}

// Revalidate every hour — same cadence as /api/flow-map/summary
export const revalidate = 3600

function formatDollars(cents: number) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

interface FlowMapPageProps {
  searchParams: Promise<{ city?: string; category?: string }>
}

export default async function FlowMapPage({ searchParams }: FlowMapPageProps) {
  const serviceClient = createServiceClient()
  const params = await searchParams

  // ── Public summary data ──────────────────────────────────────────────────────

  const { data: spendRows } = await serviceClient
    .from('spend_events')
    .select('amount_cents, listing_id')
    .eq('aggregate_opt_out', false)

  const spendData = spendRows ?? []
  const totalAmountCents = spendData.reduce((sum, r) => sum + r.amount_cents, 0)
  const totalTransactions = spendData.length
  const uniqueBusinessCount = new Set(spendData.map((r) => r.listing_id).filter(Boolean)).size

  // ── City / category filters ──────────────────────────────────────────────────
  //
  // These filters SELECT which businesses are shown. They do not re-aggregate
  // anything. City and category are attributes of the business, not slices of an
  // individual transaction, so narrowing the set of flow_nodes rows on display
  // leaves AGGREGATE_MIN_TRANSACTIONS meaning exactly what it means unfiltered:
  // this named business has at least that many transactions behind its total.
  // A filter can hide a business from the page. It can never publish one that
  // was being withheld, and it never changes a published figure.
  //
  // The community-wide numbers at the top are deliberately NOT sliced — see the
  // note beneath the summary cards and lib/spend/aggregate-privacy.ts.

  const [{ data: cityOptions }, { data: categoryOptions }] = await Promise.all([
    serviceClient.from('cities').select('id, name, slug').order('name'),
    serviceClient
      .from('categories')
      .select('id, name, slug')
      .is('parent_id', null)
      .eq('is_active', true)
      .order('display_order'),
  ])

  const cities = cityOptions ?? []
  const categories = categoryOptions ?? []

  const requestedCity = params.city?.trim() || undefined
  const requestedCategory = params.category?.trim() || undefined

  // Resolve slugs against the real lists rather than trusting the URL. An
  // unknown slug is a miss, not a silently-ignored param — /discover ignoring
  // unrecognized facet values is tracked debt, not a pattern to copy.
  const selectedCity = requestedCity ? (cities.find((c) => c.slug === requestedCity) ?? null) : null
  const selectedCategory = requestedCategory
    ? (categories.find((c) => c.slug === requestedCategory) ?? null)
    : null

  const filtersActive = !!(requestedCity || requestedCategory)
  const unresolvedFilter =
    (!!requestedCity && !selectedCity) || (!!requestedCategory && !selectedCategory)

  // Which listings the filter admits. null means "no filter" — every listing.
  let filteredListingIds: string[] | null = null
  if (selectedCity || selectedCategory) {
    const base = serviceClient.from('listings').select('id')
    const byCity = selectedCity ? base.eq('city_id', selectedCity.id) : base
    const scoped = selectedCategory ? byCity.eq('category_id', selectedCategory.id) : byCity
    const { data: matchingListings } = await scoped
    filteredListingIds = (matchingListings ?? []).map((l) => l.id)
  }

  const noMatches =
    unresolvedFilter || (filteredListingIds !== null && filteredListingIds.length === 0)

  // A city node totals every category in that city. Showing one beside a
  // category-filtered business table would read as the category's city total,
  // which it is not — so the city table is withheld when a category filter is
  // on without a city, and says why.
  const showCityTable = !selectedCategory || !!selectedCity

  // Top business nodes. Gated at the threshold the privacy panel below promises —
  // naming a business next to a dollar figure is the disclosure that matters, and
  // below the bar it approaches publishing one person's receipt.
  async function loadBusinessNodes() {
    if (noMatches) return []
    const base = serviceClient
      .from('flow_nodes')
      .select('entity_id, total_amount_cents, transaction_count')
      .eq('node_type', 'business')
      .gte('transaction_count', AGGREGATE_MIN_TRANSACTIONS)
    const scoped = filteredListingIds ? base.in('entity_id', filteredListingIds) : base
    const { data } = await scoped.order('total_amount_cents', { ascending: false }).limit(10)
    return data ?? []
  }

  const businessNodes = await loadBusinessNodes()

  const businessIds = (businessNodes ?? []).map((n) => n.entity_id)
  let businessMap: Record<string, { name: string; href: string }> = {}
  if (businessIds.length > 0) {
    const { data: listings } = await serviceClient
      .from('listings')
      .select('id, name, slug, entity_type, cities!listings_city_id_fkey(slug)')
      .in('id', businessIds)
    businessMap = Object.fromEntries(
      (listings ?? []).map((l) => [
        l.id,
        {
          name: l.name,
          href: buildEntityUrl(l.entity_type, (l.cities as { slug: string } | null)?.slug, l.slug),
        },
      ])
    )
  }

  const topBusinesses = (businessNodes ?? []).map((n) => ({
    entity_id: n.entity_id,
    name: businessMap[n.entity_id]?.name ?? 'Unknown Business',
    href: businessMap[n.entity_id]?.href ?? null,
    total_amount_cents: n.total_amount_cents,
    transaction_count: n.transaction_count,
  }))

  // Top city nodes
  async function loadCityNodes() {
    if (noMatches || !showCityTable) return []
    const base = serviceClient
      .from('flow_nodes')
      .select('entity_id, total_amount_cents, transaction_count')
      .eq('node_type', 'city')
      .gte('transaction_count', AGGREGATE_MIN_TRANSACTIONS)
    const scoped = selectedCity ? base.eq('entity_id', selectedCity.id) : base
    const { data } = await scoped.order('total_amount_cents', { ascending: false }).limit(8)
    return data ?? []
  }

  const cityNodes = await loadCityNodes()

  const cityIds = (cityNodes ?? []).map((n) => n.entity_id)
  let cityMap: Record<string, string> = {}
  if (cityIds.length > 0) {
    const { data: cities } = await serviceClient.from('cities').select('id, name').in('id', cityIds)
    cityMap = Object.fromEntries((cities ?? []).map((c) => [c.id, c.name]))
  }

  const topCities = (cityNodes ?? []).map((n) => ({
    entity_id: n.entity_id,
    name: cityMap[n.entity_id] ?? 'Unknown City',
    total_amount_cents: n.total_amount_cents,
    transaction_count: n.transaction_count,
  }))

  // SVG network nodes
  const networkNodes = topBusinesses.slice(0, 8).map((b) => ({
    id: b.entity_id,
    label: b.name,
    transactionCount: b.transaction_count,
  }))

  // ── Auth — personal impact ────────────────────────────────────────────────────

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let personalImpact: {
    totalAmountCents: number
    uniqueBusinesses: number
    approvedCount: number
    pendingCount: number
    topBusinesses: {
      listing_id: string
      name: string
      slug: string
      amount_cents: number
      receipt_count: number
    }[]
  } | null = null

  if (user) {
    const { data: receipts } = await serviceClient
      .from('receipt_uploads')
      .select('id, listing_id, amount_cents, status')
      .eq('user_id', user.id)
      .in('status', ['approved', 'pending_review'])

    const userReceipts = receipts ?? []
    const approved = userReceipts.filter((r) => r.status === 'approved')
    const pending = userReceipts.filter((r) => r.status === 'pending_review')

    const piTotal = approved.reduce((sum, r) => sum + r.amount_cents, 0)
    const piUniqueBusinessIds = new Set(approved.map((r) => r.listing_id).filter(Boolean))

    const topListingAmounts = approved.reduce<Record<string, number>>((acc, r) => {
      if (r.listing_id) acc[r.listing_id] = (acc[r.listing_id] ?? 0) + r.amount_cents
      return acc
    }, {})

    const topListingIds = Object.entries(topListingAmounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id)

    let piBusinesses: {
      listing_id: string
      name: string
      slug: string
      amount_cents: number
      receipt_count: number
    }[] = []
    if (topListingIds.length > 0) {
      const { data: listingRows } = await serviceClient
        .from('listings')
        .select('id, name, slug')
        .in('id', topListingIds)
      const piListingMap = Object.fromEntries(
        (listingRows ?? []).map((l) => [l.id, { name: l.name, slug: l.slug }])
      )
      piBusinesses = topListingIds.map((id) => ({
        listing_id: id,
        name: piListingMap[id]?.name ?? 'Unknown Business',
        slug: piListingMap[id]?.slug ?? '',
        amount_cents: topListingAmounts[id] ?? 0,
        receipt_count: approved.filter((r) => r.listing_id === id).length,
      }))
    }

    personalImpact = {
      totalAmountCents: piTotal,
      uniqueBusinesses: piUniqueBusinessIds.size,
      approvedCount: approved.length,
      pendingCount: pending.length,
      topBusinesses: piBusinesses,
    }
  }

  const hasAnyData = totalAmountCents > 0

  return (
    <main className="min-h-screen bg-pale-lavender pt-16 pb-16 px-4">
      <div className="max-w-[800px] mx-auto space-y-10">
        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div className="pt-6">
          <div className="inline-flex items-center gap-1.5 bg-amber-gold/10 text-amber-700 rounded-full px-3 py-1 font-subhead text-xs font-semibold mb-4">
            Community Dollar Flow · Beta
          </div>
          {/*
            The figure is labeled for what it measures. One approved receipt is
            one unit of spend, counted once — consumer to business. It is not
            "circulated": that word means multi-hop velocity, and the schema
            cannot express a second hop (flow_nodes.node_type CHECKs to
            'business' | 'city'). See docs/blacqlist/flow-map/
            data-sourcing-and-methodology.md §2.
          */}
          <h1 className="font-headline text-4xl md:text-5xl text-brand-black leading-tight">
            {hasAnyData
              ? `${formatDollars(totalAmountCents)} spent with Black-owned businesses`
              : 'Where does our money go?'}
          </h1>
          <p className="font-subhead text-sm text-charcoal-soft mt-3 max-w-[520px] leading-relaxed">
            Every receipt submitted to The BLACQList becomes an anonymized data point in our
            community dollar-flow map. No buyer names. No private data. Just the collective movement
            of dollars.
          </p>
          <div className="flex items-center gap-3 mt-6">
            <Link
              href="/account/receipts/new"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
            >
              Submit a receipt
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
            <Link
              href="/account/receipts"
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full border border-charcoal/20 text-brand-black font-subhead font-bold text-sm hover:bg-white transition-colors"
            >
              View my receipts
            </Link>
          </div>
        </div>

        {/* ── Summary cards ─────────────────────────────────────────────────── */}
        {hasAnyData ? (
          <div className="space-y-2">
            <FlowSummaryCards
              totalAmountCents={totalAmountCents}
              totalTransactions={totalTransactions}
              uniqueBusinesses={uniqueBusinessCount}
            />
            {/*
              The filters below narrow the businesses and cities on display. They
              do not narrow these three figures, and the copy says so rather than
              letting the reader assume it. Slicing a community-wide sum by city
              or category would produce small-population totals for a figure the
              privacy notice describes as "a single sum across everything
              reported, so they identify no one" — that promise only holds while
              the sum stays whole.
            */}
            {filtersActive && (
              <p className="font-body text-xs text-charcoal-soft">
                These three figures are community-wide. Filters apply to the businesses and cities
                listed below them.
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-brand-black text-white p-8 text-center">
            <p className="font-headline text-2xl">Be the first to contribute</p>
            <p className="font-body text-sm text-white/50 mt-2 max-w-sm mx-auto">
              Submit your first receipt to start building the community dollar-flow map.
            </p>
          </div>
        )}

        {/* ── City/category filters ─────────────────────────────────────────── */}
        {/* Above the network and the tables, because it scopes both. */}
        <FlowMapFilters cities={cities} categories={categories} />

        {/* ── Network visualization ─────────────────────────────────────────── */}
        <FlowMapNetwork nodes={networkNodes} />

        {/* ── Top businesses + cities ───────────────────────────────────────── */}
        {filtersActive && topBusinesses.length === 0 ? (
          /*
            The filtered-empty state, distinct from the two unfiltered ones. It
            has to be its own block because "no results for these filters" and
            "nothing has cleared the threshold yet" call for different actions,
            and because a filtered dead end with no way out is the failure this
            page can most easily create.
          */
          <div className="rounded-xl bg-white border border-charcoal/10 px-5 py-8 text-center">
            <p className="font-subhead text-sm font-semibold text-brand-black">
              No results for these filters
            </p>
            <p className="font-body text-xs text-charcoal-soft mt-1 mb-4 max-w-sm mx-auto">
              {unresolvedFilter
                ? 'That city or category is not one we track. Clear the filters to see the full map.'
                : `Nothing here has cleared the privacy threshold yet. A business appears once ${AGGREGATE_MIN_TRANSACTIONS} or more transactions are behind its total.`}
            </p>
            <Link
              href="/flow-map"
              className="inline-flex items-center gap-2 h-9 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
            >
              Clear filters
            </Link>
          </div>
        ) : (
          <div className={showCityTable ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-3'}>
            {/*
              Empty text names the threshold. "No businesses yet" was true when
              these tables showed everything; now a business can exist, be matched,
              and still be held back for having fewer than AGGREGATE_MIN_TRANSACTIONS
              transactions behind it. Telling someone there is no data when there is
              data being withheld is the same copy-vs-code gap as the privacy notice.
            */}
            <FlowNodeTable
              nodes={topBusinesses}
              title="Top businesses"
              linkToEntity
              emptyText={`No businesses to show yet. A business appears here once ${AGGREGATE_MIN_TRANSACTIONS} or more transactions are behind its total.`}
            />
            {showCityTable ? (
              <FlowNodeTable
                nodes={topCities}
                title={selectedCity ? 'This city' : 'Top cities'}
                emptyText={`No cities to show yet. A city appears here once ${AGGREGATE_MIN_TRANSACTIONS} or more transactions are behind its total.`}
              />
            ) : (
              <p className="font-body text-xs text-charcoal-soft">
                City totals cover every category in that city, so they are not shown while a
                category filter is on. Add a city filter to see one city, or clear the category to
                see them all.
              </p>
            )}
          </div>
        )}

        {/* ── Personal impact ───────────────────────────────────────────────── */}
        <div className="rounded-xl border border-charcoal/10 overflow-hidden">
          <div className="bg-brand-black px-5 py-4">
            <h2 className="font-headline text-base text-white">Your personal impact</h2>
          </div>

          {!user ? (
            <div className="bg-white px-5 py-8 text-center">
              <Lock className="size-6 text-charcoal/20 mx-auto mb-3" aria-hidden="true" />
              <p className="font-subhead text-sm font-semibold text-brand-black">
                Sign in to see your impact
              </p>
              <p className="font-body text-xs text-charcoal-soft mt-1 mb-4">
                Your personal spend data is private and only visible to you.
              </p>
              <Link
                href="/sign-in?next=/flow-map"
                className="inline-flex items-center gap-2 h-9 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
              >
                Sign in
              </Link>
            </div>
          ) : personalImpact &&
            personalImpact.approvedCount === 0 &&
            personalImpact.pendingCount === 0 ? (
            <div className="bg-white px-5 py-8 text-center">
              <p className="font-subhead text-sm font-semibold text-brand-black">No receipts yet</p>
              <p className="font-body text-xs text-charcoal-soft mt-1 mb-4">
                Submit a receipt to start tracking your personal impact.
              </p>
              <Link
                href="/account/receipts/new"
                className="inline-flex items-center gap-2 h-9 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
              >
                Submit a receipt
              </Link>
            </div>
          ) : personalImpact ? (
            <div className="bg-white px-5 py-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                    Total spent
                  </p>
                  <p className="font-headline text-2xl text-brand-black mt-0.5">
                    {formatDollars(personalImpact.totalAmountCents)}
                  </p>
                </div>
                <div>
                  <p className="font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                    Businesses
                  </p>
                  <p className="font-headline text-2xl text-brand-black mt-0.5">
                    {personalImpact.uniqueBusinesses}
                  </p>
                </div>
                <div>
                  <p className="font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                    Approved
                  </p>
                  <p className="font-headline text-2xl text-brand-black mt-0.5">
                    {personalImpact.approvedCount}
                  </p>
                </div>
                {personalImpact.pendingCount > 0 && (
                  <div>
                    <p className="font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                      Pending
                    </p>
                    <p className="font-headline text-2xl text-amber-700 mt-0.5">
                      {personalImpact.pendingCount}
                    </p>
                  </div>
                )}
              </div>

              {personalImpact.topBusinesses.length > 0 && (
                <div className="pt-3 border-t border-charcoal/5 space-y-2">
                  <p className="font-subhead text-xs text-charcoal-soft font-semibold uppercase tracking-wide">
                    Your top businesses
                  </p>
                  {personalImpact.topBusinesses.map((b) => (
                    <div key={b.listing_id} className="flex items-center justify-between gap-3">
                      <p className="font-subhead text-sm font-semibold text-brand-black truncate">
                        {b.name}
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-subhead text-sm text-brand-black tabular-nums">
                          {formatDollars(b.amount_cents)}
                        </span>
                        <span className="font-body text-xs text-charcoal-faint">
                          {b.receipt_count} {b.receipt_count === 1 ? 'receipt' : 'receipts'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2">
                <Link
                  href="/account/receipts"
                  className="font-subhead text-xs font-semibold text-amber hover:text-light-gold transition-colors"
                >
                  View all my receipts →
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Entity impact placeholder ─────────────────────────────────────── */}
        <div className="rounded-xl bg-white border border-charcoal/10 p-5 flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pale-lavender flex items-center justify-center">
            <Building2 className="size-5 text-amber" aria-hidden="true" />
          </div>
          <div>
            <p className="font-subhead text-sm font-semibold text-brand-black">
              Own a business on The BLACQList?
            </p>
            <p className="font-body text-xs text-charcoal-soft mt-0.5 mb-3">
              See how much the community has spent at your business through the owner dashboard.
              Detailed entity impact stats are available to verified business owners.
            </p>
            <Link
              href="/for-business"
              className="font-subhead text-xs font-semibold text-amber hover:text-light-gold transition-colors"
            >
              Learn about the owner dashboard →
            </Link>
          </div>
        </div>

        {/* ── Privacy notice ────────────────────────────────────────────────── */}
        <div className="rounded-xl bg-white border border-charcoal/10 px-5 py-4">
          <p className="font-subhead text-xs font-semibold text-brand-black mb-1">
            Privacy by design
          </p>
          <p className="font-body text-xs text-charcoal-soft leading-relaxed">
            All dollar-flow data is anonymized. Individual receipt details and buyer identities are
            never included in public views. A named business or city only appears here once{' '}
            {AGGREGATE_MIN_TRANSACTIONS} or more distinct transactions are behind its total. The
            community-wide figures at the top of this page are a single sum across everything
            reported, so they identify no one. Users can opt out of community aggregates at any
            time.
          </p>
        </div>
      </div>
    </main>
  )
}
