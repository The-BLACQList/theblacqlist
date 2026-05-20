import Link from "next/link"
import type { Metadata } from "next"
import { MapPin } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { ClaimSearchForm } from "@/components/claim/ClaimSearchForm"

export const metadata: Metadata = {
  title: "Claim a Listing | The BLACQList",
  description:
    "Find and claim your Black-owned business on The BLACQList to update your information, add photos, and connect with your community.",
}

interface PageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function ClaimPage({ searchParams }: PageProps) {
  const { q } = await searchParams
  const query = q?.trim() ?? ""

  let results: Array<{
    id: string
    name: string
    slug: string
    trust_tier: string
    listing_details_business: { city_text: string | null } | null
    categories: { name: string } | null
  }> = []

  if (query) {
    const supabase = await createClient()
    const { data } = await supabase
      .from("listings")
      .select(
        "id, name, slug, trust_tier, listing_details_business(city_text), categories(name)"
      )
      .eq("status", "published")
      .ilike("name", `%${query}%`)
      .order("name")
      .limit(10)

    results = (data ?? []) as typeof results
  }

  return (
    <main className="min-h-screen bg-pale-lavender pt-16 pb-16 px-4">
      <div className="max-w-[640px] mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-headline text-3xl md:text-4xl text-brand-black mb-2">
            Claim a listing
          </h1>
          <p className="font-body text-base text-charcoal leading-relaxed">
            Find your business and submit a claim to manage your page on The
            BLACQList.
          </p>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl border border-charcoal/10 p-5 mb-6">
          <ClaimSearchForm defaultValue={query} />
        </div>

        {/* Results */}
        {query && (
          <div>
            {results.length === 0 ? (
              <div className="bg-white rounded-xl border border-charcoal/10 p-6 text-center">
                <p className="font-subhead text-sm font-semibold text-brand-black mb-1">
                  No matching businesses found
                </p>
                <p className="font-body text-sm text-charcoal/60">
                  Try a different name, or{" "}
                  <Link
                    href="/add-business"
                    className="text-amber-gold hover:text-light-gold underline underline-offset-2"
                  >
                    add your business
                  </Link>{" "}
                  if it isn&apos;t listed yet.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="font-subhead text-xs text-charcoal/60 mb-3">
                  {results.length} result{results.length !== 1 ? "s" : ""} for
                  &ldquo;{query}&rdquo;
                </p>
                {results.map((listing) => {
                  const city =
                    listing.listing_details_business?.city_text
                  const isAlreadyClaimed = listing.trust_tier !== "unclaimed"

                  return (
                    <div
                      key={listing.id}
                      className="bg-white rounded-xl border border-charcoal/10 p-4 flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="font-subhead text-sm font-semibold text-brand-black truncate">
                          {listing.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {listing.categories?.name && (
                            <span className="font-body text-xs text-charcoal/60">
                              {listing.categories.name}
                            </span>
                          )}
                          {city && (
                            <span className="flex items-center gap-0.5 font-body text-xs text-charcoal/60">
                              <MapPin className="size-3" aria-hidden="true" />
                              {city}
                            </span>
                          )}
                        </div>
                      </div>

                      {isAlreadyClaimed ? (
                        <span className="flex-shrink-0 font-subhead text-xs text-charcoal/50 bg-charcoal/8 px-3 py-1 rounded-full">
                          Already claimed
                        </span>
                      ) : (
                        <Link
                          href={`/claim/${listing.id}`}
                          className="flex-shrink-0 inline-flex items-center justify-center h-9 px-4 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-gold"
                        >
                          Claim
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {!query && (
          <p className="font-body text-sm text-center text-charcoal/50 mt-8">
            Don&apos;t see your business?{" "}
            <Link
              href="/add-business"
              className="text-amber-gold hover:text-light-gold underline underline-offset-2"
            >
              Add it to The BLACQList
            </Link>
          </p>
        )}
      </div>
    </main>
  )
}
