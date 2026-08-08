import Link from 'next/link'
import { EMBER_WASH } from '@/lib/design/surfaces'

export interface FeaturedArticle {
  title: string
  slug: string
  subtitle: string | null
  authorName: string | null
  publishedAt: string | null
}

interface Props {
  article: FeaturedArticle | null
}

/**
 * BLACQLight editorial feature — the latest REAL published story (the
 * feature is live; no more "V1 / Get Notified" teaser). Hidden entirely
 * when nothing is published yet.
 */
export function BlacqlightFeature({ article }: Props) {
  if (!article) return null

  const dateLabel = article.publishedAt
    ? new Date(article.publishedAt).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <section aria-labelledby="blacqlight-heading" className="bg-pale-lavender py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10 grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-8 items-center">
        <div className="relative rounded-xl bg-deep-bg aspect-[4/3] md:aspect-[4/5] overflow-hidden">
          {/* TODO: article cover imagery once BLACQLight covers render platform-wide */}
          <span
            className="absolute inset-0"
            aria-hidden="true"
            style={{ background: EMBER_WASH }}
          />
          <span className="absolute left-5 bottom-5 font-headline text-[42px] text-gold leading-none select-none" aria-hidden="true">
            &ldquo;
          </span>
        </div>

        <div>
          <p className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-amber mb-1.5">
            BLACQLight · Founder stories
          </p>
          <h2 id="blacqlight-heading" className="font-headline text-[24px] md:text-[30px] text-brand-black text-balance max-w-[26ch]">
            {article.title}
          </h2>
          {article.subtitle && (
            <p className="font-body text-[15px] text-charcoal mt-2 max-w-[56ch]">{article.subtitle}</p>
          )}
          <p className="font-subhead text-xs text-charcoal-soft mt-2">
            {[article.authorName, dateLabel].filter(Boolean).join(' · ')}
          </p>
          <div className="flex gap-3 flex-wrap mt-5">
            <Link
              href={`/blacqlight/${article.slug}`}
              className="inline-flex items-center justify-center h-11 px-6 rounded-full border-[1.5px] border-brand-black text-brand-black font-subhead text-sm font-bold hover:bg-brand-black hover:text-white transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
            >
              Read the story
            </Link>
            <Link
              href="/blacqlight"
              className="inline-flex items-center font-subhead text-sm font-bold text-amber hover:text-brand-black underline underline-offset-2 transition-colors duration-150"
            >
              All BLACQLight stories →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
