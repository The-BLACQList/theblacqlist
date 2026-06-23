import type { Metadata } from 'next'
import Link from 'next/link'

import { createClient } from '@/lib/supabase/server'
import { BlogPostCard } from '@/components/editorial/BlogPostCard'

export const metadata: Metadata = {
  title: 'BLACQLight | The BLACQList',
  description:
    'A spotlight on the businesses, people, and movements shaping Black economic power. Stories that inspire. Profiles that matter.',
}

export default async function BLACQLightPage() {
  const supabase = await createClient()

  const { data: articles } = await supabase
    .from('editorial_articles')
    .select('id, title, slug, subtitle, author_name, published_at, tags')
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  const items = articles ?? []

  return (
    <main className="min-h-screen bg-pale-lavender">
      {/* Hero */}
      <section className="px-4 py-14 md:py-20 max-w-[960px] mx-auto">
        <p className="font-subhead text-xs font-semibold text-amber uppercase tracking-widest mb-3">
          The BLACQLight
        </p>
        <h1 className="font-headline text-4xl md:text-5xl text-brand-black leading-tight mb-4">
          Stories that inspire.
          <br />
          Profiles that matter.
        </h1>
        <p className="font-body text-base text-charcoal max-w-xl leading-relaxed">
          A spotlight on the businesses, people, and movements shaping Black economic power.
        </p>
      </section>

      {/* Grid */}
      <section className="bg-white px-4 py-12">
        <div className="max-w-[960px] mx-auto">
          {items.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-subhead text-sm font-semibold text-brand-black mb-1">
                Stories coming soon
              </p>
              <p className="font-body text-sm text-charcoal-soft">
                BLACQLight editorials are on the way. Check back soon.
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
              {items.map((a) => (
                <BlogPostCard
                  key={a.id}
                  title={a.title}
                  slug={a.slug}
                  subtitle={a.subtitle}
                  authorName={a.author_name ?? undefined}
                  publishedAt={a.published_at}
                  tags={a.tags}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
