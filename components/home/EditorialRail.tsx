import Link from 'next/link'

import { CardCarousel } from '@/components/home/CardCarousel'
import { BlogPostCard } from '@/components/editorial/BlogPostCard'
import { GuideCard } from '@/components/editorial/GuideCard'

export interface RailArticle {
  slug: string
  title: string
  subtitle: string | null
  authorName: string
  publishedAt: string | null
  tags: string[] | null
}

export interface RailGuide {
  id: string
  slug: string
  title: string
  subtitle: string | null
  city: string | null
  sectionCount: number
}

interface Props {
  articles: RailArticle[]
  guides: RailGuide[]
}

/**
 * BLACQLight stories and city guides, in one scroll-snap rail below the
 * featured-article hero.
 *
 * This sits *beneath* `BlacqlightFeature` rather than replacing it: the newest
 * article keeps the two-column hero treatment, and this rail carries the rest
 * of the catalogue plus the guides, which had no homepage surface at all
 * before. At the content counts this launches with, an anchored hero plus a
 * rail reads far better than a bare three-card row.
 *
 * Server-rendered children inside the shared `CardCarousel` — swipe, arrows,
 * and keyboard all work, and scrolling is instant under `prefers-reduced-motion`.
 *
 * The `< 3` floor is the same judgment `FreshFinds` makes and for the same
 * reason: a two-card carousel reads as a broken row rather than a short one.
 * Below the floor the section removes itself entirely — the hero still renders,
 * so the homepage never shows an empty editorial slot.
 */
export function EditorialRail({ articles, guides }: Props) {
  if (articles.length + guides.length < 3) return null

  return (
    <section aria-labelledby="editorial-rail-heading" className="bg-white py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <p className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-amber mb-1.5">
              Read the culture
            </p>
            <h2
              id="editorial-rail-heading"
              className="font-headline text-[26px] md:text-[32px] text-brand-black"
            >
              More stories &amp; city guides
            </h2>
          </div>
          <Link
            href="/blacqlight"
            className="font-subhead text-sm font-bold text-brand-black underline underline-offset-4 hover:text-amber transition-colors"
          >
            All BLACQLight stories &rarr;
          </Link>
        </div>

        <div className="mt-6">
          {/*
            One flat array, deliberately. `CardCarousel` maps its children
            one-to-one into slides, so two sibling `{...map()}` expressions would
            arrive as an array *of two arrays* and render two slides — each
            holding a whole stack. `[&>*]:h-full` squares the cards up: the flex
            reel already stretches each slide to the tallest, and this passes
            that height through to the card so the footers line up despite
            variable-length subtitles.
          */}
          <CardCarousel
            ariaLabel="BLACQLight stories and city guides, horizontally scrollable"
            itemClassName="w-[280px] md:w-[300px] [&>*]:h-full"
          >
            {[
              ...articles.map((a) => (
                <BlogPostCard
                  key={`article-${a.slug}`}
                  headingLevel="h3"
                  title={a.title}
                  slug={a.slug}
                  subtitle={a.subtitle}
                  authorName={a.authorName}
                  publishedAt={a.publishedAt}
                  tags={a.tags}
                />
              )),
              ...guides.map((g) => (
                <GuideCard
                  key={`guide-${g.id}`}
                  headingLevel="h3"
                  title={g.title}
                  slug={g.slug}
                  subtitle={g.subtitle}
                  city={g.city}
                  sectionCount={g.sectionCount}
                />
              )),
            ]}
          </CardCarousel>
        </div>
      </div>
    </section>
  )
}
