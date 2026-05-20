import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { EditorialRichTextDisplay } from '@/components/editorial/EditorialRichTextDisplay'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('editorial_articles')
    .select('title, meta_description, subtitle')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!data) return { title: 'Article | The BLACQLight' }

  return {
    title: `${data.title} | The BLACQLight`,
    description:
      data.meta_description ??
      data.subtitle ??
      `Read this story on The BLACQLight by The BLACQList.`,
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: article } = await supabase
    .from('editorial_articles')
    .select('id, title, slug, subtitle, body, author_name, published_at, tags')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!article) notFound()

  return (
    <main className="min-h-screen bg-pale-lavender">
      {/* Header */}
      <section className="px-4 py-12 md:py-16 max-w-[720px] mx-auto">
        <Link
          href="/blacqlight"
          className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal/50 hover:text-amber-gold mb-6 transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          The BLACQLight
        </Link>

        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {article.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="inline-block rounded-full bg-white border border-charcoal/10 text-charcoal font-subhead text-xs px-2.5 py-0.5"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <h1 className="font-headline text-3xl md:text-4xl text-brand-black leading-tight mb-3">
          {article.title}
        </h1>
        {article.subtitle && (
          <p className="font-body text-lg text-charcoal/70 leading-relaxed mb-4">
            {article.subtitle}
          </p>
        )}

        <div className="flex items-center gap-2">
          {article.author_name && (
            <span className="font-subhead text-sm font-semibold text-brand-black">
              {article.author_name}
            </span>
          )}
          {article.author_name && article.published_at && (
            <span className="text-charcoal/30" aria-hidden="true">
              ·
            </span>
          )}
          {article.published_at && (
            <time dateTime={article.published_at} className="font-subhead text-xs text-charcoal/50">
              {formatDate(article.published_at)}
            </time>
          )}
        </div>
      </section>

      {/* Body */}
      <section className="bg-white px-4 py-12">
        <div className="max-w-[720px] mx-auto">
          {article.body ? (
            <EditorialRichTextDisplay body={article.body} />
          ) : (
            <p className="font-body text-sm text-charcoal/60 text-center py-8">
              Article content coming soon.
            </p>
          )}

          <div className="mt-12 pt-8 border-t border-charcoal/10 flex flex-col sm:flex-row gap-3">
            <Link
              href="/blacqlight"
              className="inline-flex items-center justify-center h-10 px-5 rounded-full border border-brand-black text-brand-black font-subhead font-bold text-sm hover:bg-brand-black hover:text-white transition-colors"
            >
              More stories
            </Link>
            <Link
              href="/discover"
              className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors"
            >
              Explore businesses
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
