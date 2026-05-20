import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, MapPin } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { EditorialRichTextDisplay } from '@/components/editorial/EditorialRichTextDisplay'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('guides')
    .select('title, meta_description, description')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!data) return { title: 'Guide | The BLACQList' }

  return {
    title: `${data.title} | The BLACQList`,
    description:
      data.meta_description ??
      data.description ??
      `A city guide to Black-owned businesses on The BLACQList.`,
  }
}

export default async function GuideDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: guide } = await supabase
    .from('guides')
    .select('id, title, slug, subtitle, description, city, published_at')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!guide) notFound()

  const { data: rawSections } = await supabase
    .from('guide_sections')
    .select('id, heading, body, display_order')
    .eq('guide_id', guide.id)
    .order('display_order', { ascending: true })

  const sections = rawSections ?? []

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <main className="min-h-screen bg-pale-lavender">
      {/* Header */}
      <section className="px-4 py-12 md:py-16 max-w-[720px] mx-auto">
        <Link
          href="/guides"
          className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal/50 hover:text-amber-gold mb-6 transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All guides
        </Link>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <p className="font-subhead text-xs font-semibold text-amber-gold uppercase tracking-widest">
            City Guide
          </p>
          {guide.city && (
            <span className="inline-flex items-center gap-1 font-subhead text-xs text-charcoal/50">
              <MapPin className="size-3" aria-hidden="true" />
              {guide.city}
            </span>
          )}
        </div>

        <h1 className="font-headline text-3xl md:text-4xl text-brand-black leading-tight mb-3">
          {guide.title}
        </h1>
        {guide.subtitle && (
          <p className="font-body text-lg text-charcoal/70 leading-relaxed mb-3">
            {guide.subtitle}
          </p>
        )}
        {guide.published_at && (
          <time dateTime={guide.published_at} className="font-subhead text-xs text-charcoal/40">
            {formatDate(guide.published_at)}
          </time>
        )}
      </section>

      {/* Body */}
      <section className="bg-white px-4 py-12">
        <div className="max-w-[720px] mx-auto">
          {guide.description && (
            <p className="font-body text-base text-charcoal leading-relaxed mb-8">
              {guide.description}
            </p>
          )}

          {sections.length === 0 ? (
            <p className="font-body text-sm text-charcoal/60 py-8 text-center">
              Sections coming soon.
            </p>
          ) : (
            <div className="space-y-10">
              {sections.map((section) => (
                <div key={section.id}>
                  <h2 className="font-headline text-xl text-brand-black mb-4">{section.heading}</h2>
                  {section.body && <EditorialRichTextDisplay body={section.body} />}
                </div>
              ))}
            </div>
          )}

          <div className="mt-12 pt-8 border-t border-charcoal/10 flex flex-col sm:flex-row gap-3">
            <Link
              href="/guides"
              className="inline-flex items-center justify-center h-10 px-5 rounded-full border border-brand-black text-brand-black font-subhead font-bold text-sm hover:bg-brand-black hover:text-white transition-colors"
            >
              All guides
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
