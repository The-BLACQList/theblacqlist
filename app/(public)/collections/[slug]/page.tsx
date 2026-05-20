import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { buildEntityUrl } from '@/lib/listings/url'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('collections')
    .select('title, description')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!data) return { title: 'Collection | The BLACQList' }

  return {
    title: `${data.title} | The BLACQList`,
    description:
      data.description ?? `A curated collection of Black-owned businesses on The BLACQList.`,
  }
}

export default async function CollectionDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: collection } = await supabase
    .from('collections')
    .select('id, title, slug, description')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!collection) notFound()

  // Fetch listings in this collection via collection_items join
  const { data: items } = await supabase
    .from('collection_items')
    .select(
      `
      display_order,
      listings (
        id, name, slug, tagline, entity_type, trust_tier, city_id,
        cities ( slug, name, state_abbr )
      )
    `
    )
    .eq('collection_id', collection.id)
    .order('display_order', { ascending: true })

  const listings = (items ?? []).map((item) => item.listings).filter(Boolean) as Array<{
    id: string
    name: string
    slug: string
    tagline: string | null
    entity_type: string
    trust_tier: string
    city_id: string | null
    cities: { slug: string; name: string; state_abbr: string } | null
  }>

  return (
    <main className="min-h-screen bg-pale-lavender">
      {/* Header */}
      <section className="px-4 py-12 md:py-16 max-w-[960px] mx-auto">
        <Link
          href="/collections"
          className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal/50 hover:text-amber-gold mb-6 transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All collections
        </Link>
        <p className="font-subhead text-xs font-semibold text-amber-gold uppercase tracking-widest mb-2">
          Collection
        </p>
        <h1 className="font-headline text-3xl md:text-4xl text-brand-black leading-tight mb-3">
          {collection.title}
        </h1>
        {collection.description && (
          <p className="font-body text-base text-charcoal max-w-xl leading-relaxed">
            {collection.description}
          </p>
        )}
        <p className="font-subhead text-xs text-charcoal/50 mt-3">
          {listings.length} {listings.length === 1 ? 'business' : 'businesses'}
        </p>
      </section>

      {/* Listings */}
      <section className="bg-white px-4 py-12">
        <div className="max-w-[960px] mx-auto">
          {listings.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-subhead text-sm font-semibold text-brand-black mb-1">
                No businesses in this collection yet
              </p>
              <p className="font-body text-sm text-charcoal/60">
                Check back soon — we&apos;re curating this list.
              </p>
              <Link
                href="/discover"
                className="inline-flex items-center justify-center mt-5 h-10 px-6 rounded-full border border-brand-black text-brand-black font-subhead font-bold text-sm hover:bg-brand-black hover:text-white transition-colors"
              >
                Explore all businesses
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-charcoal/5">
              {listings.map((listing) => {
                const city = listing.cities
                const location = city ? `${city.name}, ${city.state_abbr}` : null
                const href = buildEntityUrl(listing.entity_type, city?.slug, listing.slug)

                return (
                  <article key={listing.id} className="py-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-subhead text-[11px] text-charcoal/50 capitalize">
                          {listing.entity_type.replace(/_/g, ' ')}
                        </span>
                        {location && (
                          <>
                            <span className="text-charcoal/25" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-subhead text-[11px] text-charcoal/50">
                              {location}
                            </span>
                          </>
                        )}
                      </div>
                      <h2 className="font-headline text-base text-brand-black leading-snug">
                        <Link href={href} className="hover:text-amber-gold transition-colors">
                          {listing.name}
                        </Link>
                      </h2>
                      {listing.tagline && (
                        <p className="font-body text-sm text-charcoal/60 mt-0.5 line-clamp-2 leading-relaxed">
                          {listing.tagline}
                        </p>
                      )}
                    </div>
                    <Link
                      href={href}
                      className="shrink-0 inline-flex items-center justify-center h-9 px-4 rounded-full border border-charcoal/20 text-brand-black font-subhead font-semibold text-xs hover:border-amber-gold/40 hover:text-amber-gold transition-colors"
                    >
                      View
                    </Link>
                  </article>
                )
              })}
            </div>
          )}

          <div className="mt-10 text-center">
            <Link
              href="/collections"
              className="inline-flex items-center justify-center h-11 px-6 rounded-full border border-brand-black text-brand-black font-subhead font-bold text-sm hover:bg-brand-black hover:text-white transition-colors"
            >
              Browse all collections
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
