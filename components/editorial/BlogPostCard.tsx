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
}: Props) {
  return (
    <Link
      href={`/blacqlight/${slug}`}
      className="group flex flex-col gap-3 rounded-xl border border-charcoal/10 bg-white p-5 hover:border-amber-gold/40 hover:shadow-md transition-all"
    >
      {tags && tags.length > 0 && (
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
        <Heading className="font-headline text-base text-brand-black group-hover:text-amber transition-colors leading-snug">
          {title}
        </Heading>
        {subtitle && (
          <p className="font-body text-sm text-charcoal-soft leading-relaxed mt-1 line-clamp-2">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 mt-auto pt-1">
        {authorName && (
          <span className="font-subhead text-xs text-charcoal-soft">{authorName}</span>
        )}
        {authorName && publishedAt && (
          <span className="text-charcoal-faint" aria-hidden="true">
            ·
          </span>
        )}
        {publishedAt && (
          <time dateTime={publishedAt} className="font-subhead text-xs text-charcoal-soft">
            {formatDate(publishedAt)}
          </time>
        )}
      </div>
    </Link>
  )
}
