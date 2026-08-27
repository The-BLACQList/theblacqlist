import type { Metadata } from 'next'
import Link from 'next/link'
import { Store, MapPin, Package, Briefcase, ArrowRight, AlertTriangle } from 'lucide-react'

import { createServiceClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Storefronts | BLACQList Marketplace',
  description:
    'Browse Black-owned storefronts on The BLACQList. Shop products, book services, and buy direct from the business.',
}

export const revalidate = 3600

// Hard cap on the grid. Not pagination — a bound, so this page can never fan out
// into an unbounded query. Revisit (add pagination) when the real count gets
// within sight of it rather than pre-building paging for a set this small.
const MAX_STOREFRONTS = 60

// The number of marketplace rows scanned to build the seller set. Products and
// services are counted per listing from these rows, so a vendor whose offerings
// fall past this window would show a low count, not a wrong page. Same reasoning
// as MAX_STOREFRONTS: bounded on purpose, generous relative to current volume.
const MAX_OFFERING_ROWS = 2000

type CityRef = { name: string; states: { code: string } | null } | null
type CategoryRef = { name: string } | null

export default async function VendorsIndexPage() {
  const serviceClient = createServiceClient()

  // ── Step 1: who actually sells something ────────────────────────────────────
  // Only listing_id is needed. The rows are then counted per listing for the
  // "3 products · 1 service" line on each card.
  //
  // Every select on this page destructures `error`. A failed PostgREST select
  // returns data: null, which renders the *identical* "No storefronts yet" empty
  // state as a genuinely empty catalog — so without this, an operator cannot tell
  // "no data" from "broken query." That ambiguity is what a broken column name in
  // the select shape below costs, and it has cost it before.
  const [
    { data: productRows, error: productError },
    { data: serviceRows, error: serviceError },
  ] = await Promise.all([
    serviceClient
      .from('marketplace_products')
      .select('listing_id')
      .eq('status', 'active')
      .limit(MAX_OFFERING_ROWS),
    serviceClient
      .from('marketplace_services')
      .select('listing_id')
      .eq('status', 'active')
      .limit(MAX_OFFERING_ROWS),
  ])

  // A failure here does not blank the page — it silently collapses sellerIds to
  // [], which drops the query to the vendor-only branch and hides every
  // non-vendor-typed storefront. Quieter than an empty page and harder to spot.
  if (productError) {
    console.error('[vendors] marketplace_products query failed:', productError.message)
  }
  if (serviceError) {
    console.error('[vendors] marketplace_services query failed:', serviceError.message)
  }

  const productCounts = new Map<string, number>()
  for (const row of productRows ?? []) {
    productCounts.set(row.listing_id, (productCounts.get(row.listing_id) ?? 0) + 1)
  }

  const serviceCounts = new Map<string, number>()
  for (const row of serviceRows ?? []) {
    serviceCounts.set(row.listing_id, (serviceCounts.get(row.listing_id) ?? 0) + 1)
  }

  const sellerIds = [...new Set([...productCounts.keys(), ...serviceCounts.keys()])]

  // ── Step 2: resolve the storefronts ─────────────────────────────────────────
  // THIS RULE MUST STAY IDENTICAL TO app/(public)/vendors/[slug]/page.tsx:61 —
  // "vendor-typed OR it actually sells something." If this index is broader than
  // the detail page, it lists cards that 404 on click; if it is narrower, it
  // hides live storefronts that products link to via "Sold by". The two are one
  // contract expressed twice because PostgREST cannot express the OR half in the
  // same query that fetches the marketplace rows it depends on.
  //
  // The select shape mirrors the detail page and lib/listings/query.ts: `cities`
  // has no state_abbr column, it joins out to states.code. Asking for
  // cities(name, state_abbr) errors the whole select and returns zero rows.
  const query = serviceClient
    .from('listings')
    .select(
      'id, name, slug, tagline, trust_tier, entity_type, cities(name, states(code)), categories(name)'
    )
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('name', { ascending: true })
    .limit(MAX_STOREFRONTS)

  const { data: listingRows, error: listingError } =
    sellerIds.length > 0
      ? await query.or(`entity_type.eq.vendor,id.in.(${sellerIds.join(',')})`)
      : await query.eq('entity_type', 'vendor')

  if (listingError) {
    console.error('[vendors] listings query failed:', listingError.message)
  }

  // Only the listings query blanks the grid outright, so only it earns a
  // distinguishable failure state. A marketplace-query failure is logged above
  // and degrades the counts rather than the page.
  const loadFailed = Boolean(listingError)

  const storefronts = (listingRows ?? [])
    .map((listing) => {
      const cityRef = listing.cities as CityRef
      const categoryRef = listing.categories as CategoryRef
      const products = productCounts.get(listing.id) ?? 0
      const services = serviceCounts.get(listing.id) ?? 0
      return {
        id: listing.id,
        name: listing.name,
        slug: listing.slug,
        tagline: listing.tagline as string | null,
        trust_tier: listing.trust_tier as string | null,
        category: categoryRef?.name ?? null,
        city: cityRef ? `${cityRef.name}, ${cityRef.states?.code ?? ''}`.replace(/, $/, '') : null,
        products,
        services,
        offerings: products + services,
      }
    })
    // Storefronts with something to buy come first. A vendor-typed listing with
    // no active offerings is a legitimate page but a thin one — it should not sit
    // above a shop with twelve products just because its name starts with A.
    .sort((a, b) => b.offerings - a.offerings || a.name.localeCompare(b.name))

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="bg-white border-b border-charcoal/10 py-8">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="mb-3">
            <ol className="flex items-center gap-1.5 font-body text-xs text-charcoal-faint">
              <li>
                <Link href="/marketplace" className="hover:text-charcoal">
                  Marketplace
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-charcoal" aria-current="page">
                Storefronts
              </li>
            </ol>
          </nav>

          <h1 className="font-headline text-3xl text-brand-black">Storefronts</h1>
          <p className="font-body text-sm text-charcoal-soft mt-1.5 max-w-2xl">
            {storefronts.length > 0
              ? `${storefronts.length} Black-owned ${storefronts.length === 1 ? 'business' : 'businesses'} selling directly on The BLACQList. Buy from the shop, not the middleman.`
              : 'Black-owned businesses selling directly on The BLACQList.'}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-10">
        {loadFailed ? (
          // Distinct from "No storefronts yet" on purpose — these two states look
          // identical from the database's side (both arrive as an empty list) and
          // must not look identical on screen.
          //
          // ⚠ There is deliberately NO "Try again" button. revalidate = 3600 caches
          // this render like any other, so a retry inside the ISR window would
          // re-serve the cached failure — a button that cannot work. The honest
          // action is an escape to a page that does, and the server log above is
          // the real alarm. If this state ever needs a working retry, the route has
          // to opt out of caching on the error path first.
          <div className="rounded-xl border border-charcoal/10 bg-white py-16 text-center">
            <AlertTriangle className="size-12 text-charcoal/20 mx-auto mb-4" aria-hidden="true" />
            <p className="font-headline text-lg text-brand-black">Couldn&apos;t load storefronts</p>
            <p className="font-body text-sm text-charcoal-soft mt-2 max-w-sm mx-auto">
              Something went wrong on our end — this isn&apos;t an empty marketplace. Check back
              shortly.
            </p>
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-1.5 mt-5 h-10 px-5 rounded-full bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold transition-colors min-h-[44px]"
            >
              Browse the marketplace <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        ) : storefronts.length === 0 ? (
          <div className="rounded-xl border border-charcoal/10 bg-white py-16 text-center">
            <Store className="size-12 text-charcoal/20 mx-auto mb-4" aria-hidden="true" />
            <p className="font-headline text-lg text-brand-black">No storefronts yet</p>
            <p className="font-body text-sm text-charcoal-soft mt-2 max-w-sm mx-auto">
              Businesses are still setting up their shops. Check back soon — or open yours and be
              among the first.
            </p>
            <Link
              href="/for-vendors"
              className="inline-flex items-center gap-1.5 mt-5 h-10 px-5 rounded-full bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold transition-colors min-h-[44px]"
            >
              Sell on BLACQList <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {storefronts.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/vendors/${s.slug}`}
                  className="group flex flex-col h-full rounded-xl border border-charcoal/10 bg-white p-5 hover:border-amber-gold hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-headline text-lg text-brand-black leading-snug group-hover:text-charcoal">
                      {s.name}
                    </h2>
                    {s.trust_tier === 'verified' && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-green-100 font-subhead text-[11px] font-semibold text-green-700">
                        Verified
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                    {s.category && (
                      <span className="font-subhead text-xs text-charcoal-soft">{s.category}</span>
                    )}
                    {s.city && (
                      <span className="flex items-center gap-1 font-body text-xs text-charcoal-soft">
                        <MapPin className="size-3 shrink-0" aria-hidden="true" />
                        {s.city}
                      </span>
                    )}
                  </div>

                  {s.tagline && (
                    <p className="font-body text-sm text-charcoal-soft mt-3 leading-relaxed line-clamp-2">
                      {s.tagline}
                    </p>
                  )}

                  <div className="flex items-center gap-4 mt-auto pt-4">
                    {s.products > 0 && (
                      <span className="flex items-center gap-1.5 font-body text-xs text-charcoal-faint">
                        <Package className="size-3.5 shrink-0" aria-hidden="true" />
                        {s.products} {s.products === 1 ? 'product' : 'products'}
                      </span>
                    )}
                    {s.services > 0 && (
                      <span className="flex items-center gap-1.5 font-body text-xs text-charcoal-faint">
                        <Briefcase className="size-3.5 shrink-0" aria-hidden="true" />
                        {s.services} {s.services === 1 ? 'service' : 'services'}
                      </span>
                    )}
                    {s.offerings === 0 && (
                      <span className="font-body text-xs text-charcoal-faint">
                        Storefront coming soon
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
