import Link from 'next/link'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { createClient, createServiceClient } from '@/lib/supabase/server'
import { buildEntityUrl } from '@/lib/listings/url'
import { readAllRows, readInBatches } from '@/lib/supabase/read-all'
import { readCountedSpend } from '@/lib/spend/counted-spend'
import {
  AGGREGATE_MIN_TRANSACTIONS,
  LINK_MIN_TRANSACTIONS,
  communityTotals,
} from '@/lib/spend/aggregate-privacy'
import {
  businessDisplayName,
  buildSiloBusinesses,
  type BusinessListingMeta,
} from '@/lib/spend/silo-layout'
import {
  CollectiveHowItWorks,
  FirstLookButton,
  FirstLookSteps,
} from '@/components/flow-map/CollectiveFirstLook'
import { SiloExperience } from '@/components/flow-map/silo/SiloExperience'
import type { SiloTickerItem } from '@/components/flow-map/silo/SiloPanels'
import { pickFirstLookState } from '@/lib/spend/collective-first-look'
import { pickView, VIEW_COOKIE } from '@/lib/spend/collective-demo'

export const metadata: Metadata = {
  title: 'The Collective | The BLACQList',
  description:
    'The Collective is one live map of what The BLACQList community spends with the businesses on the list. Shown in aggregate only. No buyer identities exposed.',
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
  searchParams: Promise<{ you?: string; view?: string }>
}

export default async function FlowMapPage({ searchParams }: FlowMapPageProps) {
  const serviceClient = createServiceClient()
  const params = await searchParams

  // ── Public summary data ──────────────────────────────────────────────────────

  // The spend read is paged past the API's row cap (ticket 278).
  const [{ data: spendData, error: spendError }, { data: businessNodes, error: businessError }] =
    await Promise.all([
      readCountedSpend(serviceClient),
      serviceClient
        .from('flow_nodes')
        .select('entity_id, total_amount_cents, transaction_count')
        .eq('node_type', 'business')
        .gte('transaction_count', LINK_MIN_TRANSACTIONS)
        .order('total_amount_cents', { ascending: false })
        .limit(500),
    ])
  // Null until enough receipts are counted site-wide (ticket 286). Held figures
  // and the Latest rows never leave the server.
  const totals = communityTotals(spendData)

  // ── Collective businesses (tickets 167 and 171) ──────────────────────────────
  //
  // Every published business is a dot, so the spread of the list shows before
  // any receipt is counted (ticket 171). Spend totals are a separate read. A
  // business gets its line from LINK_MIN_TRANSACTIONS counted receipt (ticket
  // 250), but its total stays gated at the threshold the methodology page
  // promises: below AGGREGATE_MIN_TRANSACTIONS a business total approaches
  // publishing one person's receipt, so buildSiloBusinesses zeroes it and it
  // never leaves the server. Events and jobs are listings but not places money
  // is spent.

  const LISTING_SELECT =
    'id, name, slug, entity_type, primary_level, category_id, cities!listings_city_id_fkey(slug)'

  const businessIds = (businessNodes ?? []).map((n) => n.entity_id)
  const listingMeta: Record<string, BusinessListingMeta> = {}
  let listingsError = false
  {
    // Every published business, past the API's row cap (ticket 278). Reading in
    // id order is fine: buildSiloBusinesses sorts.
    const [allRes, { data: categoryRows }] = await Promise.all([
      readAllRows((afterId, limit) =>
        serviceClient
          .from('listings')
          .select(LISTING_SELECT, { count: 'exact' })
          .eq('status', 'published')
          .is('deleted_at', null)
          .not('entity_type', 'in', '(event,job)')
          .gt('id', afterId)
          .order('id', { ascending: true })
          .limit(limit)
      ),
      serviceClient.from('categories').select('id, slug, parent_id'),
    ])
    // A published event or job with counted receipts keeps its dot. Everything
    // else with receipts is already in the read above.
    const readIds = new Set(allRes.data.map((l) => l.id))
    const linkedRes = await readInBatches(
      allRes.error ? [] : businessIds.filter((id) => !readIds.has(id)),
      (ids) =>
        serviceClient
          .from('listings')
          .select(LISTING_SELECT)
          .eq('status', 'published')
          .is('deleted_at', null)
          .in('id', ids)
    )
    listingsError = !!allRes.error || !!linkedRes.error
    const listings = [...linkedRes.data, ...allRes.data]

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
  // Ticket 250: businesses where the reader has a receipt still in review. Only
  // this reader's page gets them, as a dashed line that says "on its way".
  const youPendingIds = new Set<string>()

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
      if (r.status === 'pending_review' && !r.aggregate_opt_out && r.listing_id) {
        youPendingIds.add(r.listing_id)
      }
    }
  }

  // Every business shows by name: a published listing is already public
  // (founder, 2026-10-31, ticket 171b). Lines show from 1 counted receipt;
  // totals stay server-side until a business clears the threshold
  // (buildSiloBusinesses, ticket 250).
  const siloBusinesses = buildSiloBusinesses({
    nodes: businessNodes ?? [],
    listings: listingMeta,
    youIds,
    youPendingIds,
  })

  // The latest three receipts at linked businesses (from 1 counted receipt,
  // ticket 250), by name and the day only. Never an amount. Held with the
  // totals (ticket 286): beside one counted receipt's total, a name and a day
  // are that receipt.
  const siloById = new Map(siloBusinesses.map((b) => [b.id, b]))
  const ticker: SiloTickerItem[] = (totals ? spendData : [])
    .filter((r) => r.listing_id && siloById.get(r.listing_id)?.linked)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3)
    .map((r, i) => ({
      id: `${i}-${r.created_at}`,
      label: businessDisplayName(siloById.get(r.listing_id!)!),
      when: dayLabel(r.created_at),
    }))

  // A failed read and an empty read both arrive as []. The page never explains
  // a failure as a finding, so a failed read gets its own state.
  const siloLoadFailed = !!spendError || !!businessError || listingsError

  // Ticket 249: while few businesses have a line, the map opens on sample data,
  // with a Demo / Live switch. A reader with a line of their own opens on Live.
  const initialView = pickView({
    param: params.view,
    stored: (await cookies()).get(VIEW_COOKIE)?.value,
    realLinked: siloBusinesses.filter((b) => b.linked).length,
    hasOwnLines: youIds.size > 0 || youPendingIds.size > 0,
    focusYou: params.you === '1',
  })

  const firstLookState = pickFirstLookState({
    signedIn: Boolean(user),
    receiptCount,
    countFailed: receiptCountFailed,
  })

  // The figure is labeled for what it measures. One approved receipt is one
  // unit of spend, counted once, consumer to business. It is not "circulated":
  // that word means multi-hop velocity, and the schema cannot express a second
  // hop (flow_nodes.node_type CHECKs to 'business' | 'city'). See
  // docs/blacqlist/flow-map/data-sourcing-and-methodology.md §2.
  const headline = totals
    ? `${formatDollars(totals.amountCents)} spent with businesses on the list`
    : 'Where Does Our Money Go?'

  // Ticket 247: no light hero. The page is dark end to end, the map starts
  // under the header, and the headline plays as the map's opening title. The
  // h1 stays in the page for readers and search; the steps sit under the map.
  return (
    <div className="min-h-screen bg-deep-bg">
      <h1 className="sr-only">{headline}</h1>

      {/* ── The Collective (tickets 167, 171 and 247) ─────────────────────── */}
      {/* Full bleed. The HUD is server-rendered HTML; the 3D scene loads on its
          own chunk after mount and only on this route. The CSV downloads and the
          privacy notes moved to /flow-map/methodology (ticket 171). */}
      {siloLoadFailed ? (
        <div className="px-4 pt-16 pb-8">
          <div className="max-w-[800px] mx-auto rounded-xl bg-white/[0.04] border border-white/10 px-5 py-8 text-center">
            <p className="font-subhead text-sm font-semibold text-[#fcfaf4]">
              We couldn&apos;t load The Collective.
            </p>
            <p className="font-body text-xs text-[#cdc6b6] mt-1 mb-4 max-w-sm mx-auto">
              Something went wrong on our end, so we can&apos;t show the map or its totals right
              now.
            </p>
            <Link
              href="/flow-map"
              prefetch={false}
              className="inline-flex items-center gap-2 h-11 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
            >
              Try Again
            </Link>
          </div>
        </div>
      ) : (
        <SiloExperience
          totalSpentCents={totals?.amountCents ?? null}
          receiptCount={totals?.receipts ?? null}
          businesses={siloBusinesses}
          cities={topCities}
          ticker={ticker}
          focusYou={params.you === '1'}
          initialView={initialView}
          headline={headline}
          cta={<FirstLookButton state={firstLookState} size="sm" />}
          steps={<FirstLookSteps layout="sheet" />}
        />
      )}

      {/* [Decision — founder, 2026-10-15 (simplicity P4)] Ticket 161's three
          steps stay; ticket 247 moves them under the map and into More. */}
      <CollectiveHowItWorks state={firstLookState} countedTotal={formatDollars(countedCents)} />
    </div>
  )
}
