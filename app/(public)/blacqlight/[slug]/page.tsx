import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { Container } from '@/components/layout/container'
import { BlogPostCard } from '@/components/editorial/BlogPostCard'
import { EditorialRichTextDisplay } from '@/components/editorial/EditorialRichTextDisplay'
import { resolveStoryCover } from '@/lib/editorial/cover'
import { PHOTO_FOCAL } from '@/lib/design/surfaces'
import { cn } from '@/lib/utils'
import { editorialKind } from '@/lib/editorial/kind'
import { readMinutes } from '@/lib/editorial/readTime'
import { loadLinkedListings, type LinkedListing } from '@/lib/editorial/linkedListings'
import {
  OWNERSHIP_LABEL_META,
  TRUST_TIER_META,
  type OwnershipLabel,
  type TrustTier,
} from '@/lib/constants/listing'

// Ticket 117, the BLACQLight article page. Spec:
// docs/blacqlist/design/page-workshop-2026-10-spec.md §3 "Article page changes".

interface Props {
  params: Promise<{ slug: string }>
}

const FEATURED_MAX = 3
const MORE_COUNT = 3

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

const pill =
  'inline-flex min-h-[48px] items-center justify-center px-6 rounded-full font-subhead text-[15px] font-semibold transition-colors duration-150'

export default async function ArticleDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: article } = await supabase
    .from('editorial_articles')
    .select('id, title, slug, subtitle, body, author_name, published_at, tags, cover_image_path')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (!article) notFound()

  const [featured, { data: others }] = await Promise.all([
    loadLinkedListings(supabase, [article.body], FEATURED_MAX),
    supabase
      .from('editorial_articles')
      .select('id, title, slug, subtitle, body, author_name, tags, cover_image_path')
      .eq('status', 'published')
      .neq('id', article.id)
      .order('published_at', { ascending: false })
      .limit(MORE_COUNT),
  ])

  const kind = editorialKind(article.tags)
  const cover = resolveStoryCover(article.cover_image_path)

  return (
    <main className="min-h-screen bg-off-white">
      {/* Header */}
      <section className="bg-pale-lavender">
        <Container className="max-w-[880px] pt-10 md:pt-14 pb-10 md:pb-14 flex flex-col items-center gap-4 text-center">
          <Link
            href="/blacqlight"
            className="self-start inline-flex min-h-[44px] items-center gap-1.5 font-subhead text-sm font-semibold text-charcoal-soft hover:text-amber transition-colors"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            The BLACQLight
          </Link>
          {kind && (
            <p className="font-subhead text-xs font-bold uppercase tracking-[0.14em] text-amber">
              {kind}
            </p>
          )}
          <h1 className="font-headline font-medium text-[clamp(36px,5.5vw,72px)] leading-[1.05] tracking-[-0.01em] text-brand-black text-balance">
            {article.title}
          </h1>
          {article.subtitle && (
            <p className="font-body text-lg md:text-xl leading-relaxed text-charcoal max-w-[56ch]">
              {article.subtitle}
            </p>
          )}
          <p className="font-subhead text-sm text-charcoal-soft">
            By <span className="font-semibold text-brand-black">{article.author_name}</span>
            {article.published_at && (
              <>
                {' · '}
                <time dateTime={article.published_at}>{formatDate(article.published_at)}</time>
              </>
            )}
            {' · '}
            {readMinutes(article.body)} min read
          </p>
        </Container>
      </section>

      {/* Cover. No caption until there is a column for one (ticket 118). */}
      {cover && (
        <Container className="max-w-[1120px] -mb-2 pt-0">
          <figure className="relative aspect-[16/9] overflow-hidden rounded-[3px] bg-deep-bg">
            <Image
              src={cover}
              alt=""
              fill
              priority
              sizes="(min-width: 1120px) 1120px, 100vw"
              className={cn('object-cover', PHOTO_FOCAL[cover])}
            />
          </figure>
        </Container>
      )}

      {/* Body */}
      <section className="bg-off-white">
        <Container className="max-w-[720px] py-12 md:py-16">
          {article.body ? (
            <EditorialRichTextDisplay body={article.body} variant="story" />
          ) : (
            <p className="font-body text-sm text-charcoal-soft text-center py-8">
              Article content coming soon.
            </p>
          )}

          {featured.length > 0 && <FeaturedInStory listings={featured} />}

          <div className="mt-12 pt-8 border-t border-charcoal/10 flex flex-col sm:flex-row gap-3">
            <Link
              href="/blacqlight"
              className={`${pill} border border-brand-black text-brand-black hover:bg-brand-black hover:text-white`}
            >
              More stories
            </Link>
            <Link
              href="/discover"
              className={`${pill} bg-gold text-brand-black hover:bg-light-gold`}
            >
              Explore businesses
            </Link>
          </div>
        </Container>
      </section>

      {others && others.length > 0 && (
        <section className="bg-white" aria-labelledby="more-heading">
          <Container className="py-14 md:py-20 flex flex-col gap-8">
            <h2
              id="more-heading"
              className="font-headline font-medium text-[28px] md:text-[36px] leading-[1.1] text-ink"
            >
              More stories
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {others.map((a) => (
                <BlogPostCard
                  key={a.id}
                  title={a.title}
                  slug={a.slug}
                  subtitle={a.subtitle}
                  authorName={a.author_name}
                  headingLevel="h3"
                  kind={editorialKind(a.tags)}
                  readMinutes={readMinutes(a.body)}
                  coverSrc={resolveStoryCover(a.cover_image_path)}
                />
              ))}
            </div>
          </Container>
        </section>
      )}
    </main>
  )
}

function tierLabel(tier: string): string {
  return TRUST_TIER_META[tier as TrustTier]?.label ?? tier
}

function ownershipLabel(label: string): string {
  return OWNERSHIP_LABEL_META[label as OwnershipLabel]?.label ?? label
}

/** One card per published listing the story links to (max 3). */
function FeaturedInStory({ listings }: { listings: LinkedListing[] }) {
  return (
    <section className="mt-12 flex flex-col gap-4" aria-labelledby="featured-heading">
      <h2
        id="featured-heading"
        className="font-subhead text-xs font-bold uppercase tracking-[0.14em] text-amber"
      >
        Featured in this story
      </h2>
      <ul className="flex flex-col gap-4 list-none m-0 p-0">
        {listings.map((l) => (
          <li
            key={l.id}
            className="flex flex-col gap-4 rounded-[3px] bg-deep-bg p-6 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-1">
              <p className="font-headline text-[22px] leading-tight text-off-white">{l.name}</p>
              {(l.category || l.city) && (
                <p className="font-body text-sm text-ink-soft">
                  {[l.category, l.city].filter(Boolean).join(' · ')}
                </p>
              )}
              <p className="font-subhead text-xs font-semibold uppercase tracking-[0.1em] text-gold">
                {tierLabel(l.trustTier)} · {ownershipLabel(l.ownershipLabel)}
              </p>
            </div>
            <Link
              href={l.href}
              className={`${pill} shrink-0 bg-gold text-brand-black hover:bg-light-gold`}
              aria-label={`Visit ${l.name}'s page`}
            >
              Visit their page
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
