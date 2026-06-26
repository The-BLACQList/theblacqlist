import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { EditorialRichTextDisplay } from '@/components/editorial/EditorialRichTextDisplay'
import {
  CollectionBusinessCard,
  type CollectionListing,
} from '@/components/editorial/CollectionBusinessCard'

// ISR: collections refresh hourly (matches the performance spec — collections 3600).
export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('collections')
    .select('title, description, subtitle')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!data) return { title: 'Collection | The BLACQList' }

  return {
    title: `${data.title} | The BLACQList`,
    description:
      data.description ??
      data.subtitle ??
      `A curated collection of Black-owned businesses on The BLACQList.`,
  }
}

interface CollectionItemRow {
  display_order: number
  headline: string | null
  blurb: string | null
  listings: CollectionListing | null
}

export default async function CollectionDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: collection } = await supabase
    .from('collections')
    .select('id, title, slug, subtitle, description, body, cover_image_path')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (!collection) notFound()

  // Businesses in this collection, with per-item editorial context.
  const { data: items, error: itemsError } = await supabase
    .from('collection_items')
    .select(
      `
      display_order,
      headline,
      blurb,
      listings (
        id, name, slug, tagline, entity_type, trust_tier, cover_image_path,
        cities ( slug, name, states ( code ) )
      )
    `
    )
    .eq('collection_id', collection.id)
    .order('display_order', { ascending: true })

  if (itemsError) console.error('Collection items query failed:', itemsError.message)

  // Editorial sections (deeper narrative blocks).
  const { data: sections } = await supabase
    .from('collection_sections')
    .select('id, heading, body, display_order')
    .eq('collection_id', collection.id)
    .order('display_order', { ascending: true })

  const entries = ((items ?? []) as unknown as CollectionItemRow[]).filter((i) => i.listings)
  const hasCover = Boolean(collection.cover_image_path)

  return (
    <main className="min-h-screen bg-pale-lavender">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      {hasCover ? (
        <section className="relative w-full h-[280px] md:h-[420px] overflow-hidden bg-deep-bg">
          <Image
            src={collection.cover_image_path as string}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to bottom, rgba(8,8,10,0.35) 0%, transparent 35%, rgba(8,8,10,0.85) 100%)',
            }}
            aria-hidden="true"
          />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-8 md:pb-10">
            <div className="max-w-[960px] mx-auto">
              <CollectionEyebrow onDark />
              <h1 className="font-headline text-3xl md:text-5xl text-white leading-tight mb-2">
                {collection.title}
              </h1>
              {collection.subtitle && (
                <p className="font-body text-base md:text-lg text-white/80 max-w-2xl leading-relaxed">
                  {collection.subtitle}
                </p>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="px-4 pt-12 pb-8 md:pt-16 max-w-[960px] mx-auto">
          <Link
            href="/collections"
            className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal-soft hover:text-amber mb-6 transition-colors"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            All collections
          </Link>
          <CollectionEyebrow />
          <h1 className="font-headline text-3xl md:text-5xl text-brand-black leading-tight mb-3">
            {collection.title}
          </h1>
          {collection.subtitle && (
            <p className="font-body text-lg text-charcoal/80 max-w-2xl leading-relaxed">
              {collection.subtitle}
            </p>
          )}
        </section>
      )}

      {/* ── Body: intro + businesses + sections ──────────────────────────── */}
      <section className="bg-white px-4 py-10 md:py-14">
        <div className="max-w-[960px] mx-auto">
          {hasCover && (
            <Link
              href="/collections"
              className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal-soft hover:text-amber mb-8 transition-colors"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              All collections
            </Link>
          )}

          {/* Narrative intro */}
          {collection.body ? (
            <div className="max-w-[680px]">
              <EditorialRichTextDisplay body={collection.body} />
            </div>
          ) : (
            collection.description && (
              <p className="font-body text-base text-charcoal leading-relaxed max-w-[680px]">
                {collection.description}
              </p>
            )
          )}

          {/* Businesses */}
          <div className="mt-10 md:mt-12">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="font-headline text-xl text-brand-black">In this collection</h2>
              <span className="font-subhead text-xs text-charcoal-soft">
                {entries.length} {entries.length === 1 ? 'business' : 'businesses'}
              </span>
            </div>

            {entries.length === 0 ? (
              <div className="text-center py-16 rounded-2xl border border-dashed border-charcoal/15">
                <p className="font-subhead text-sm font-semibold text-brand-black mb-1">
                  No businesses in this collection yet
                </p>
                <p className="font-body text-sm text-charcoal-soft">
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
              <div className="grid gap-4">
                {entries.map((entry, i) => (
                  <CollectionBusinessCard
                    key={entry.listings!.id}
                    listing={entry.listings as CollectionListing}
                    blurb={entry.blurb}
                    headline={entry.headline}
                    position={i + 1}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Editorial sections */}
          {(sections ?? []).length > 0 && (
            <div className="mt-12 md:mt-16 space-y-10 max-w-[680px]">
              {(sections ?? []).map((section) => (
                <section key={section.id}>
                  <h2 className="font-headline text-2xl text-brand-black mb-3">{section.heading}</h2>
                  {section.body && <EditorialRichTextDisplay body={section.body} />}
                </section>
              ))}
            </div>
          )}

          {/* Footer CTAs */}
          <div className="mt-14 pt-8 border-t border-charcoal/10 flex flex-col sm:flex-row gap-3">
            <Link
              href="/collections"
              className="inline-flex items-center justify-center h-11 px-6 rounded-full border border-brand-black text-brand-black font-subhead font-bold text-sm hover:bg-brand-black hover:text-white transition-colors"
            >
              Browse all collections
            </Link>
            <Link
              href="/discover"
              className="inline-flex items-center justify-center h-11 px-6 rounded-full bg-amber text-white font-subhead font-bold text-sm hover:bg-amber/90 transition-colors"
            >
              Explore businesses
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

function CollectionEyebrow({ onDark = false }: { onDark?: boolean }) {
  return (
    <p
      className={`font-subhead text-xs font-semibold uppercase tracking-widest mb-2 ${
        onDark ? 'text-gold' : 'text-amber'
      }`}
    >
      Collection
    </p>
  )
}
