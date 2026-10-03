import Image from 'next/image'
import Link from 'next/link'

interface Props {
  title: string
  slug: string
  subtitle?: string | null
  authorName?: string
  publishedAt?: string | null
  tags?: string[] | null
  /**
   * The card's title element. Defaults to `h2` for the `/blacqlight` index,
   * where the page title is the `h1`. The homepage rail passes `h3` because
   * its own section heading is already an `h2` — same level the listing cards
   * use inside a carousel (`EntityCard.tsx`).
   */
  headingLevel?: 'h2' | 'h3'
  /** Kind label from lib/editorial/kind.ts. When set it replaces the tag chips. */
  kind?: string | null
  /** Read time in minutes (lib/editorial/readTime.ts). Shown after the author. */
  readMinutes?: number
  /** Resolved cover URL. With none, the card is type-only (no stock photo). */
  coverSrc?: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function BlogPostCard({
  title,
  slug,
  subtitle,
  authorName,
  publishedAt,
  tags,
  headingLevel: Heading = 'h2',
  kind,
  readMinutes,
  coverSrc,
}: Props) {
  const showTags = kind === undefined && tags && tags.length > 0
  return (
    <Link
      href={`/blacqlight/${slug}`}
      className="group flex flex-col gap-3 rounded-xl border border-charcoal/10 bg-white p-5 hover:border-amber-gold/40 hover:shadow-md transition-all"
    >
      {coverSrc && (
        <div className="relative aspect-[3/2] -mx-5 -mt-5 mb-1 overflow-hidden rounded-t-xl bg-deep-bg">
          <Image
            src={coverSrc}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      )}
      {kind && (
        <p className="font-subhead text-xs font-bold uppercase tracking-[0.14em] text-amber">
          {kind}
        </p>
      )}
      {showTags && (
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-full bg-pale-lavender text-charcoal font-subhead text-xs px-2.5 py-0.5"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <div>
        <Heading
          className={`font-headline ${kind === undefined ? 'text-base' : 'text-xl md:text-2xl'} text-brand-black group-hover:text-amber transition-colors leading-snug`}
        >
          {title}
        </Heading>
        {subtitle && (
          <p className="font-body text-sm text-charcoal-soft leading-relaxed mt-1 line-clamp-2">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
        {authorName && (
          <span className="font-subhead text-xs text-charcoal-soft">{authorName}</span>
        )}
        {authorName && (publishedAt || readMinutes) && (
          <span className="text-charcoal-faint" aria-hidden="true">
            ·
          </span>
        )}
        {readMinutes ? (
          <span className="font-subhead text-xs text-charcoal-soft">{readMinutes} min read</span>
        ) : (
          publishedAt && (
            <time dateTime={publishedAt} className="font-subhead text-xs text-charcoal-soft">
              {formatDate(publishedAt)}
            </time>
          )
        )}
      </div>
    </Link>
  )
}
