import Link from 'next/link'
import type { Metadata } from 'next'
import { Lock, Building2 } from 'lucide-react'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { buildEntityUrl } from '@/lib/listings/url'
import { AGGREGATE_MIN_TRANSACTIONS } from '@/lib/spend/aggregate-privacy'
import {
  anonymousBusinessLabel,
  buildSiloBusinesses,
  type BusinessListingMeta,
} from '@/lib/spend/silo-layout'
import { CollectiveFirstLook } from '@/components/flow-map/CollectiveFirstLook'
import { SiloExperience } from '@/components/flow-map/silo/SiloExperience'
import type { SiloTickerItem } from '@/components/flow-map/silo/SiloPanels'
import { pickFirstLookState } from '@/lib/spend/collective-first-look'

export const metadata: Metadata = {
  title: 'The Collective | The BLACQList',
  description:
    'The Collective is one live map of what the BLACQList community spends with the businesses on the list. Shown in aggregate only. No buyer identities exposed.',
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

/** Day only, in UTC, so the ticker never pins a receipt to an hour. */
function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

interface FlowMapPageProps {
  searchParams: Promise<{ you?: string }>
}

export default async function FlowMapPage({ searchParams }: FlowMapPageProps) {
  const serviceClient = createServiceClient()
  const params = await searchParams

  // ── Public summary data ──────────────────────────────────────────────────────

  const { data: spendRows, error: spendError } = await serviceClient
    .from('spend_events')
    .select('amount_cents, listing_id, created_at')
    .eq('aggregate_opt_out', false)

  const spendData = spendRows ?? []
  const totalAmountCents = spendData.reduce((sum, r) => sum + r.amount_cents, 0)
  const totalTransactions = spendData.length

  // ── Silo businesses (ticket 167) ─────────────────────────────────────────────
  //
  // Gated at the threshold the privacy panel below promises. Below the bar a
  // business total approaches publishing one person's receipt. The city and
  // category filters are gone with the old network (the Silo's legend narrows
  // by kind or level on the client, over rows that already cleared the bar).

  const { data: businessNodes, error: businessError } = await serviceClient
    .from('flow_nodes')
    .select('entity_id, total_amount_cents, transaction_count')
    .eq('node_type', 'business')
    .gte('transaction_count', AGGREGATE_MIN_TRANSACTIONS)
    .order('total_amount_cents', { ascending: false })
    .limit(500)

  const businessIds = (businessNodes ?? []).map((n) => n.entity_id)
  const listingMeta: Record<string, BusinessListingMeta> = {}
  let listingsError = false
  if (businessIds.length > 0) {
    const [{ data: listings, error }, { data: categoryRows }] = await Promise.all([
      serviceClient
        .from('listings')
        .select(
          'id, name, slug, entity_type, primary_level, category_id, cities!listings_city_id_fkey(slug)'
        )
        .in('id', businessIds),
      serviceClient.from('categories').select('id, slug, parent_id'),
    ])
    listingsError = !!error

    // A category's family comes from its top-level parent. If the categories
    // read fails, every dot falls back to the default family rather than failing
    // the page: color is a reading aid, not a figure.
    const categoryById = new Map((categoryRows ?? []).map((c) => [c.id, c]))
    function topSlug(categoryId: string | null): string | null {
      let c = categoryId ? categoryById.get(categoryId) : undefined
      for (let i = 0; c?.parent_id && i < 5; i++) c = categoryById.get(c.parent_id) ?? c
      return c?.slug ?? null
    }

    for (const l of listings ?? []) {
      listingMeta[l.id] = {
        name: l.name,
        href: buildEntityUrl(l.entity_type, (l.cities as { slug: string } | null)?.slug, l.slug),
        level: l.primary_level,
        categorySlug: topSlug(l.category_id),
      }
    }
  }

  // ── Top cities (for the list view) ───────────────────────────────────────────

  const { data: cityNodes } = await serviceClient
    .from('flow_nodes')
    .select('entity_id, total_amount_cents, transaction_count')
    .eq('node_type', 'city')
    .gte('transaction_count', AGGREGATE_MIN_TRANSACTIONS)
    .order('total_amount_cents', { ascending: false })
    .limit(8)

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

  // The first look (ticket 161) needs every receipt the reader has sent in,
  // whatever its status, to tell a first-timer from a returning member. The
  // personal impact block below still reads approved and waiting only.
  let receiptCount = 0
  let receiptCountFailed = false

  // The Silo's "You": businesses where the reader has an approved receipt that
  // counts toward community figures. A receipt kept out of the figures never
  // marks a dot, because that dot's total doesn't include it.
  const youIds = new Set<string>()

  if (user) {
    const { data: receipts, error: receiptsError } = await serviceClient
      .from('receipt_uploads')
      .select('id, listing_id, amount_cents, status, aggregate_opt_out')
      .eq('user_id', user.id)

    receiptCount = receipts?.length ?? 0
    receiptCountFailed = Boolean(receiptsError)

    for (const r of receipts ?? []) {
      if (r.status === 'approved' && !r.aggregate_opt_out && r.listing_id) youIds.add(r.listing_id)
    }

    const userReceipts = (receipts ?? []).filter(
      (r) => r.status === 'approved' || r.status === 'pending_review'
    )
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

  // Names stay hidden for every business until there is an opt-in to read.
  // The reader's own businesses are the one exception (buildSiloBusinesses):
  // they already know where they shopped. Built here, on the server, so a
  // hidden name never reaches the browser.
  const siloBusinesses = buildSiloBusinesses({
    nodes: businessNodes ?? [],
    listings: listingMeta,
    isNameOptedIn: () => false,
    youIds,
  })

  // The latest three receipts at businesses that cleared the bar, named by
  // their kind and the day only.
  const siloById = new Map(siloBusinesses.map((b) => [b.id, b]))
  const ticker: SiloTickerItem[] = spendData
    .filter((r) => r.listing_id && siloById.has(r.listing_id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3)
    .map((r, i) => ({
      id: `${i}-${r.created_at}`,
      label: anonymousBusinessLabel(siloById.get(r.listing_id!)!, false),
      when: dayLabel(r.created_at),
    }))

  // A failed read and an empty read both arrive as []. The page never explains
  // a failure as a finding, so a failed read gets its own state.
  const siloLoadFailed = !!spendError || !!businessError || listingsError

  const hasAnyData = totalAmountCents > 0

  const firstLookState = pickFirstLookState({
    signedIn: Boolean(user),
    receiptCount,
    countFailed: receiptCountFailed,
  })

  return (
    <main className="min-h-screen bg-pale-lavender pt-16 pb-16">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="px-4">
        <div className="max-w-[800px] mx-auto pt-6 pb-10">
          <div className="inline-flex items-center gap-1.5 bg-amber-gold/10 text-amber-700 rounded-full px-3 py-1 font-subhead text-xs font-semibold mb-4">
            The Collective · Beta
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
              ? `${formatDollars(totalAmountCents)} spent with businesses on the list`
              : 'Where does our money go?'}
          </h1>
          {/* [Decision — founder, 2026-10-15 (simplicity P4): tester was "still a
              bit confused on what/how the collective works."] Ticket 161 answers
              that with three steps and one button picked for the reader. */}
          <CollectiveFirstLook
            state={firstLookState}
            countedTotal={formatDollars(personalImpact?.totalAmountCents ?? 0)}
          />
        </div>
      </div>

      {/* ── The Silo (ticket 167) ─────────────────────────────────────────── */}
      {/* Full bleed. The HUD is server-rendered HTML; the 3D scene loads on its
          own chunk after mount and only on this route. */}
      {siloLoadFailed ? (
        <div className="px-4">
          <div className="max-w-[800px] mx-auto rounded-xl bg-white border border-charcoal/10 px-5 py-8 text-center">
            <p className="font-subhead text-sm font-semibold text-brand-black">
              We couldn&apos;t load The Collective.
            </p>
            <p className="font-body text-xs text-charcoal-soft mt-1 mb-4 max-w-sm mx-auto">
              Something went wrong on our end, so we can&apos;t show the map or its totals right
              now.
            </p>
            <Link
              href="/flow-map"
              prefetch={false}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
            >
              Try again
            </Link>
          </div>
        </div>
      ) : (
        <SiloExperience
          totalSpentCents={totalAmountCents}
          receiptCount={totalTransactions}
          businesses={siloBusinesses}
          cities={topCities}
          ticker={ticker}
          focusYou={params.you === '1'}
        />
      )}

      <div className="px-4 pt-10">
        <div className="max-w-[800px] mx-auto space-y-10">
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
                <p className="font-subhead text-sm font-semibold text-brand-black">
                  No receipts yet
                </p>
                <p className="font-body text-xs text-charcoal-soft mt-1 mb-4">
                  Add a receipt to start tracking your personal impact.
                </p>
                <Link
                  href="/account/receipts/new"
                  className="inline-flex items-center gap-2 h-9 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
                >
                  Add a receipt
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

          {/* ── Downloadable reports ──────────────────────────────────────────── */}
          {/*
          These files are the whole set at or above the same
          {AGGREGATE_MIN_TRANSACTIONS}-transaction threshold as the Silo, nothing
          looser. Unlike the Silo, they name each business (deviation noted on
          ticket 167: the export predates the opt-in rule). Plain <a> rather than
          next/link: these are file downloads, not client-side navigations.
        */}
          <div className="rounded-xl bg-white border border-charcoal/10 px-5 py-4">
            <p className="font-subhead text-xs font-semibold text-brand-black mb-1">
              Download the data
            </p>
            <p className="font-body text-xs text-charcoal-soft leading-relaxed mb-3">
              Check our numbers yourself. Each file is a spreadsheet (CSV) listing every business or
              city that meets the {AGGREGATE_MIN_TRANSACTIONS}-transaction threshold described
              below, with its total in both dollars and cents. Because entities below that threshold
              are left out, these files will total less than the community-wide figures at the top
              of this page. That gap is the privacy floor doing its job.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <a
                href="/api/flow-map/export?dataset=businesses"
                download
                className="font-subhead text-xs font-semibold text-amber hover:text-light-gold transition-colors"
              >
                Businesses (CSV) ↓
              </a>
              <a
                href="/api/flow-map/export?dataset=cities"
                download
                className="font-subhead text-xs font-semibold text-amber hover:text-light-gold transition-colors"
              >
                Cities (CSV) ↓
              </a>
            </div>
          </div>

          {/* ── Privacy notice ────────────────────────────────────────────────── */}
          <div className="rounded-xl bg-white border border-charcoal/10 px-5 py-4">
            <p className="font-subhead text-xs font-semibold text-brand-black mb-1">
              Privacy by design
            </p>
            <p className="font-body text-xs text-charcoal-soft leading-relaxed">
              All dollar-flow data is anonymized. Individual receipt details and buyer identities
              are never included in public views. A named business or city only appears here once{' '}
              {AGGREGATE_MIN_TRANSACTIONS} or more distinct transactions are behind its total. The
              community-wide figures at the top of this page are a single sum across everything
              reported, so they identify no one. When you add a receipt you can choose to keep it
              out of community figures.
            </p>
            <Link
              href="/flow-map/methodology"
              className="font-subhead text-xs font-semibold text-amber hover:text-light-gold transition-colors mt-2 inline-block"
            >
              How we count community spend →
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
