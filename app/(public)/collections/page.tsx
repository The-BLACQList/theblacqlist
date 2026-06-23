import type { Metadata } from 'next'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { CollectionCard } from '@/components/editorial/CollectionCard'

export const metadata: Metadata = {
  title: 'Collections | The BLACQList',
  description:
    'Curated lists of Black-owned businesses by category, occasion, city, and theme. Find the perfect spot for any need.',
}

export default async function CollectionsPage() {
  const supabase = await createClient()

  const { data: collections } = await supabase
    .from('collections')
    .select('id, title, slug, description')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  const items = collections ?? []

  // Get listing counts per collection
  const { data: counts } = await supabase.from('collection_items').select('collection_id')

  const countMap: Record<string, number> = {}
  for (const row of counts ?? []) {
    countMap[row.collection_id] = (countMap[row.collection_id] ?? 0) + 1
  }

  return (
    <main className="min-h-screen bg-pale-lavender">
      {/* Hero */}
      <section className="px-4 py-14 md:py-20 max-w-[960px] mx-auto">
        <p className="font-subhead text-xs font-semibold text-amber uppercase tracking-widest mb-3">
          Collections
        </p>
        <h1 className="font-headline text-4xl md:text-5xl text-brand-black leading-tight mb-4">
          Curated for your community
        </h1>
        <p className="font-body text-base text-charcoal max-w-xl leading-relaxed">
          Hand-picked lists of Black-owned businesses by occasion, city, and theme.
        </p>
      </section>

      {/* Grid */}
      <section className="bg-white px-4 py-12">
        <div className="max-w-[960px] mx-auto">
          {items.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-subhead text-sm font-semibold text-brand-black mb-1">
                No collections yet
              </p>
              <p className="font-body text-sm text-charcoal-soft">
                Check back soon — curated lists are on the way.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((c) => (
                <CollectionCard
                  key={c.id}
                  title={c.title}
                  slug={c.slug}
                  description={c.description}
                  listingCount={countMap[c.id] ?? 0}
                />
              ))}
            </div>
          )}

          <div className="mt-10 text-center">
            <Link
              href="/discover"
              className="inline-flex items-center justify-center h-11 px-6 rounded-full border border-brand-black text-brand-black font-subhead font-bold text-sm hover:bg-brand-black hover:text-white transition-colors"
            >
              Explore all businesses
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
