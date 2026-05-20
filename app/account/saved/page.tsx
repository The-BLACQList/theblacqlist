import Link from "next/link"
import { redirect } from "next/navigation"
import { Bookmark, ArrowLeft, ExternalLink } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { SaveButton } from "@/components/entity-page/SaveButton"
import { buildEntityUrl } from "@/lib/listings/url"

export default async function SavedListingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect("/sign-in?next=/account/saved")

  const { data: saves } = await supabase
    .from("saves")
    .select(`
      id,
      listing_id,
      created_at,
      listings!inner(
        id, name, slug, tagline, entity_type, trust_tier, status,
        cities!listings_city_id_fkey(name, slug, states!cities_state_id_fkey(code)),
        listing_details_business(phone, website_url)
      )
    `)
    .eq("user_id", user.id)
    .is("listings.deleted_at", null)
    .eq("listings.status", "published")
    .order("created_at", { ascending: false })

  const listings = (saves ?? []).map((s) => {
    const l = s.listings as {
      id: string
      name: string
      slug: string
      tagline: string | null
      entity_type: string
      trust_tier: string
      cities: { name: string; slug: string; states: { code: string } | null } | null
      listing_details_business: { phone: string | null; website_url: string | null } | null
    }
    return {
      saveId: s.id,
      listingId: s.listing_id,
      name: l.name,
      slug: l.slug,
      tagline: l.tagline,
      entity_type: l.entity_type,
      trust_tier: l.trust_tier,
      city: l.cities ? `${l.cities.name}, ${l.cities.states?.code ?? ""}` : null,
      citySlug: l.cities?.slug ?? null,
      website_url: l.listing_details_business?.website_url ?? null,
    }
  })

  return (
    <main className="min-h-screen bg-pale-lavender pt-16 pb-12 px-4">
      <div className="max-w-[960px] mx-auto">
        {/* Back nav */}
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 font-subhead text-sm text-charcoal hover:text-brand-black mb-6"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to account
        </Link>

        <h1 className="font-headline text-3xl text-brand-black mb-2">
          Saved businesses
        </h1>
        <p className="font-subhead text-sm text-charcoal/60 mb-8">
          {listings.length === 0
            ? "Businesses you save will appear here."
            : `${listings.length} saved ${listings.length === 1 ? "business" : "businesses"}`}
        </p>

        {listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-white border border-charcoal/10 flex items-center justify-center mb-4">
              <Bookmark className="size-7 text-charcoal/30" aria-hidden="true" />
            </div>
            <h2 className="font-headline text-xl text-brand-black mb-2">
              No saved businesses yet
            </h2>
            <p className="font-subhead text-sm text-charcoal/60 max-w-xs leading-relaxed">
              Tap the heart icon on any listing to save it here for later.
            </p>
            <Link
              href="/discover"
              className="mt-6 inline-flex items-center justify-center h-11 px-6 rounded-full bg-brand-black text-white font-body font-bold text-sm hover:bg-charcoal transition-colors"
            >
              Discover businesses
            </Link>
          </div>
        ) : (
          <ul className="space-y-3" aria-label="Saved businesses">
            {listings.map((l) => (
              <li
                key={l.saveId}
                className="bg-white rounded-xl border border-charcoal/10 p-4 flex items-start gap-4"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    href={buildEntityUrl(l.entity_type, l.citySlug, l.slug)}
                    className="font-headline text-base text-brand-black hover:text-amber-gold transition-colors line-clamp-1"
                  >
                    {l.name}
                  </Link>
                  {l.tagline && (
                    <p className="font-subhead text-sm text-charcoal/60 mt-0.5 line-clamp-1">
                      {l.tagline}
                    </p>
                  )}
                  {l.city && (
                    <p className="font-subhead text-xs text-charcoal/40 mt-1">{l.city}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {l.website_url && (
                    <a
                      href={l.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Visit ${l.name} website`}
                      className="inline-flex items-center justify-center size-9 rounded-full text-charcoal/40 hover:text-charcoal hover:bg-charcoal/5 transition-colors"
                    >
                      <ExternalLink className="size-4" aria-hidden="true" />
                    </a>
                  )}
                  <SaveButton listingId={l.listingId} initialSaved={true} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
