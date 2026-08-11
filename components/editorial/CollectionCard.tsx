import Link from 'next/link'
import { Layers } from 'lucide-react'

import { CoverImage } from '@/components/media/CoverImage'

interface Props {
  title: string
  slug: string
  description?: string | null
  listingCount?: number
  /**
   * `collections.cover_image_path` — a Supabase Storage path or an absolute URL.
   * Set from the admin collections editor. When absent the card renders the F-1
   * fallback tile rather than a stock photo, same rule as listing covers.
   */
  coverSrc?: string | null
}

export function CollectionCard({ title, slug, description, listingCount, coverSrc }: Props) {
  return (
    <Link
      href={`/collections/${slug}`}
      className="group flex flex-col rounded-xl border border-charcoal/10 bg-white overflow-hidden hover:border-amber-gold/40 hover:shadow-md transition-all"
    >
      {/* 3:2 — the house photo ratio (photographic-style-direction.md) */}
      <div className="relative aspect-[3/2] bg-deep-bg overflow-hidden">
        <CoverImage
          src={coverSrc ?? null}
          alt=""
          name={title}
          categoryName="Collection"
          seed={slug}
          sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 92vw"
          fallbackSize="card"
        />
      </div>

      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="size-9 rounded-lg bg-pale-lavender flex items-center justify-center flex-shrink-0">
            <Layers className="size-4 text-amber" aria-hidden="true" />
          </div>
          {listingCount !== undefined && (
            <span className="font-subhead text-xs text-charcoal-soft shrink-0">
              {listingCount} {listingCount === 1 ? 'business' : 'businesses'}
            </span>
          )}
        </div>
        <div>
          <h2 className="font-headline text-base text-brand-black group-hover:text-amber transition-colors leading-snug">
            {title}
          </h2>
          {description && (
            <p className="font-body text-sm text-charcoal-soft leading-relaxed mt-1 line-clamp-2">
              {description}
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}
