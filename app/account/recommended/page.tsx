import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, Sparkles, ExternalLink } from "lucide-react"
import type { Metadata } from "next"

import { createClient } from "@/lib/supabase/server"
import { buildEntityUrl } from "@/lib/listings/url"

export const metadata: Metadata = { title: "Recommended for You | Account" }

export default async function RecommendedPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in?next=/account/recommended")

  // Get saved listing IDs and their categories
  const { data: saves } = await supabase
    .from("saves")
    .select("listing_id, listings!inner(category_id)")
    .eq("user_id", user.id)
    .is("listings.deleted_at", null)

  const savedIds = (saves ?? []).map((s) => s.listing_id).filter(Boolean)
  const categoryIds = [
    ...new Set(
      (saves ?? [])
        .map((s) => (s.listings as { category_id: string } | null)?.category_id)
        .filter((id): id is string => !!id)
    ),
  ]

  type ListingRow = {
    id: string
    name: string
    slug: string
    tagline: string | null
    entity_type: string
    trust_tier: string
    cities: { name: string; slug: string; states: { code: string } | null } | null
    listing_details_business: { website_url: string | null } | null
  }

  let recommendations: ListingRow[] = []
  if (categoryIds.length > 0) {
    let query = supabase
      .from("listings")
      .select(`
        id, name, slug, tagline, entity_type, trust_tier,
        cities!listings_city_id_fkey(name, slug, states!cities_state_id_fkey(code)),
        listing_details_business(website_url)
      `)
      .in("category_id", categoryIds)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("save_count", { ascending: false })
      .limit(12)

    if (savedIds.length > 0) {
      query = query.not("id", "in", `(${savedIds.join(",")})`)
    }

    const { data } = await query
    recommendations = (data ?? []) as unknown as ListingRow[]
  }

  const hasSaves = savedIds.length > 0

  return (
    <main className="min-h-screen bg-pale-lavender pt-16 pb-12 px-4">
      <div className="max-w-[960px] mx-auto">
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 font-subhead text-sm text-charcoal hover:text-brand-black mb-6"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to account
        </Link>

        <h1 className="font-headline text-3xl text-brand-black mb-2">
          Recommended for you
        </h1>
        <p className="font-subhead text-sm text-charcoal/60 mb-8">
          {!hasSaves
            ? "Based on businesses you save."
            : recommendations.length === 0
            ? "No new recommendations right now — check back later."
            : `${recommendations.length} businesses you might like`}
        </p>

        {!hasSaves ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-white border border-charcoal/10 flex items-center justify-center mb-4">
              <Sparkles className="size-7 text-charcoal/30" aria-hidden="true" />
            </div>
            <h2 className="font-headline text-xl text-brand-black mb-2">
              Save businesses to get recommendations
            </h2>
            <p className="font-subhead text-sm text-charcoal/60 max-w-xs leading-relaxed">
              When you save businesses you love, we&apos;ll suggest similar ones you might enjoy.
            </p>
            <Link
              href="/discover"
              className="mt-6 inline-flex items-center justify-center h-11 px-6 rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors"
            >
              Discover businesses
            </Link>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-white border border-charcoal/10 flex items-center justify-center mb-4">
              <Sparkles className="size-7 text-charcoal/30" aria-hidden="true" />
            </div>
            <h2 className="font-headline text-xl text-brand-black mb-2">
              No new recommendations yet
            </h2>
            <p className="font-subhead text-sm text-charcoal/60 max-w-xs leading-relaxed">
              Save more businesses across different categories to broaden your recommendations.
            </p>
            <Link
              href="/discover"
              className="mt-6 inline-flex items-center justify-center h-11 px-6 rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors"
            >
              Keep exploring
            </Link>
          </div>
        ) : (
          <ul className="space-y-3" aria-label="Recommended businesses">
            {recommendations.map((l) => (
              <li
                key={l.id}
                className="bg-white rounded-xl border border-charcoal/10 p-4 flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    href={buildEntityUrl(l.entity_type, l.cities?.slug, l.slug)}
                    className="font-headline text-base text-brand-black hover:text-amber-gold transition-colors line-clamp-1"
                  >
                    {l.name}
                  </Link>
                  {l.tagline && (
                    <p className="font-subhead text-sm text-charcoal/60 mt-0.5 line-clamp-1">
                      {l.tagline}
                    </p>
                  )}
                  {l.cities && (
                    <p className="font-subhead text-xs text-charcoal/40 mt-1">
                      {l.cities.name}{l.cities.states?.code ? `, ${l.cities.states.code}` : ""}
                    </p>
                  )}
                </div>
                {l.listing_details_business?.website_url && (
                  <a
                    href={l.listing_details_business.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Visit ${l.name} website`}
                    className="inline-flex items-center justify-center size-9 rounded-full text-charcoal/40 hover:text-charcoal hover:bg-charcoal/5 transition-colors shrink-0"
                  >
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
