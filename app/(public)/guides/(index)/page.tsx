import type { Metadata } from 'next'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { GuideCard } from '@/components/editorial/GuideCard'

export const metadata: Metadata = {
  title: 'City Guides | The BLACQList',
  description:
    'Deep-dive guides to Black-owned businesses, neighborhoods, and culture in cities across the nation.',
}

export default async function GuidesPage() {
  const supabase = await createClient()

  const { data: guides } = await supabase
    .from('guides')
    .select('id, title, slug, subtitle, city')
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  const items = guides ?? []

  // Get section counts per guide
  const { data: sections } = await supabase.from('guide_sections').select('guide_id')

  const sectionMap: Record<string, number> = {}
  for (const row of sections ?? []) {
    sectionMap[row.guide_id] = (sectionMap[row.guide_id] ?? 0) + 1
  }

  return (
    <main className="min-h-screen bg-pale-lavender">
      {/* Hero */}
      <section className="px-4 py-14 md:py-20 max-w-[960px] mx-auto">
        <p className="font-subhead text-xs font-semibold text-amber uppercase tracking-widest mb-3">
          City Guides
        </p>
        <h1 className="font-headline text-4xl md:text-5xl text-brand-black leading-tight mb-4">
          Your insider guide to Black-owned America
        </h1>
        <p className="font-body text-base text-charcoal max-w-xl leading-relaxed">
          Deep-dive guides to Black-owned businesses, neighborhoods, and culture in cities across
          the nation.
        </p>
      </section>

      {/* Grid */}
      <section className="bg-white px-4 py-12">
        <div className="max-w-[960px] mx-auto">
          {items.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-subhead text-sm font-semibold text-brand-black mb-1">
                City guides coming soon
              </p>
              <p className="font-body text-sm text-charcoal-soft">
                Curated guides for the cities we&rsquo;re live in are on the way.
              </p>
              <Link
                href="/discover"
                className="inline-flex items-center justify-center mt-5 h-10 px-6 rounded-full border border-brand-black text-brand-black font-subhead font-bold text-sm hover:bg-brand-black hover:text-white transition-colors"
              >
                Explore businesses now
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((g) => (
                <GuideCard
                  key={g.id}
                  title={g.title}
                  slug={g.slug}
                  subtitle={g.subtitle}
                  city={g.city}
                  sectionCount={sectionMap[g.id] ?? 0}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
