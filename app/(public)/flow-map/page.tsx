import Link from 'next/link'
import type { Metadata } from 'next'

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

  // ── Collective businesses (tickets 167 and 171) ──────────────────────────────
  //
  // Every published business is a dot, so the spread of the list shows before
  // any receipt is counted (ticket 171). Spend totals are a separate read, gated
  // at the threshold the methodology page promises: below the bar a business
  // total approaches publishing one person's receipt, so it never leaves the
  // server. Events and jobs are listings but not places money is spent.

  const LISTING_SELECT =
    'id, name, slug, entity_type, primary_level, category_id, cities!listings_city_id_fkey(slug)'
  const MAP_LIMIT = 2000

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
  {
    const [allRes, linkedRes, { data: categoryRows }] = await Promise.all([
      serviceClient
        .from('listings')
        .select(LISTING_SELECT)
        .eq('status', 'published')
        .is('deleted_at', null)
        .not('entity_type', 'in', '(event,job)')
        .order('created_at', { ascending: true })
        .limit(MAP_LIMIT),
      // A business with counted receipts is always on the map, even past the cap.
      businessIds.length > 0
        ? serviceClient
            .from('listings')
            .select(LISTING_SELECT)
            .eq('status', 'published')
            .is('deleted_at', null)
            .in('id', businessIds)
        : Promise.resolve({ data: [], error: null }),
      serviceClient.from('categories').select('id, slug, parent_id'),
    ])
    listingsError = !!allRes.error || !!linkedRes.error
    const listings = [...(linkedRes.data ?? []), ...(allRes.data ?? [])]

    // A category's family comes from its top-level parent. If the categories
    // read fails, every dot falls back to the default family rather than failing
    // the page: color is a reading aid, not a figure.
    const categoryById = new Map((categoryRows ?? []).map((c) => [c.id, c]))
    function topSlug(categoryId: string | null): string | null {
      let c = categoryId ? categoryById.get(categoryId) : undefined
      for (let i = 0; c?.parent_id && i < 5; i++) c = categoryById.get(c.parent_id) ?? c
      return c?.slug ?? null
    }

    for (const l of listings) {
      if (listingMeta[l.id]) continue
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

  // ── Auth: the reader's own receipts ──────────────────────────────────────────

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // The first look (ticket 161) needs every receipt the reader has sent in,
  // whatever its status, to tell a first-timer from a returning member.
  let receiptCount = 0
  let receiptCountFailed = false
  let countedCents = 0

  // The Collective's "You": businesses where the reader has an approved receipt
  // that counts toward community figures. A receipt kept out of the figures
  // never marks a dot, because that dot's total doesn't include it.
  const youIds = new Set<string>()

  if (user) {
    const { data: receipts, error: receiptsError } = await serviceClient
      .from('receipt_uploads')
      .select('id, listing_id, amount_cents, status, aggregate_opt_out')
      .eq('user_id', user.id)

    receiptCount = receipts?.length ?? 0
    receiptCountFailed = Boolean(receiptsError)

    for (const r of receipts ?? []) {
      if (r.status === 'approved') countedCents += r.amount_cents
      if (r.status === 'approved' && !r.aggregate_opt_out && r.listing_id) youIds.add(r.listing_id)
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
    .filter((r) => r.listing_id && siloById.get(r.listing_id)?.linked)
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
      {/* ── Hero (compact, ticket 171) ──────────────────────────────────────── */}
      <div className="px-4">
        <div className="max-w-[1100px] mx-auto pt-4 pb-5">
          <p className="inline-flex items-center gap-1.5 bg-amber-gold/10 text-amber-700 rounded-full px-3 py-1 font-subhead text-xs font-semibold mb-2">
            The Collective · Beta
          </p>
          {/*
            The figure is labeled for what it measures. One approved receipt is
            one unit of spend, counted once — consumer to business. It is not
            "circulated": that word means multi-hop velocity, and the schema
            cannot express a second hop (flow_nodes.node_type CHECKs to
            'business' | 'city'). See docs/blacqlist/flow-map/
            data-sourcing-and-methodology.md §2.
          */}
          <h1 className="font-headline text-2xl md:text-3xl text-brand-black leading-tight text-balance">
            {hasAnyData
              ? `${formatDollars(totalAmountCents)} spent with businesses on the list`
              : 'Where does our money go?'}
          </h1>
          {/* [Decision — founder, 2026-10-15 (simplicity P4)] Ticket 161's three
              steps stay, folded away (ticket 171: the hero was too tall). */}
          <CollectiveFirstLook state={firstLookState} countedTotal={formatDollars(countedCents)} />
        </div>
      </div>

      {/* ── The Collective (tickets 167 and 171) ──────────────────────────── */}
      {/* Full bleed. The HUD is server-rendered HTML; the 3D scene loads on its
          own chunk after mount and only on this route. The CSV downloads and the
          privacy notes moved to /flow-map/methodology (ticket 171). */}
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
    </main>
  )
}
