import Link from 'next/link'
import { Layers } from 'lucide-react'

interface Props {
  title: string
  slug: string
  description?: string | null
  listingCount?: number
}

export function CollectionCard({ title, slug, description, listingCount }: Props) {
  return (
    <Link
      href={`/collections/${slug}`}
      className="group flex flex-col gap-3 rounded-xl border border-charcoal/10 bg-white p-5 hover:border-amber-gold/40 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="size-9 rounded-lg bg-pale-lavender flex items-center justify-center flex-shrink-0">
          <Layers className="size-4 text-amber-gold" aria-hidden="true" />
        </div>
        {listingCount !== undefined && (
          <span className="font-subhead text-xs text-charcoal/50 shrink-0">
            {listingCount} {listingCount === 1 ? 'business' : 'businesses'}
          </span>
        )}
      </div>
      <div>
        <h2 className="font-headline text-base text-brand-black group-hover:text-amber-gold transition-colors leading-snug">
          {title}
        </h2>
        {description && (
          <p className="font-body text-sm text-charcoal/60 leading-relaxed mt-1 line-clamp-2">
            {description}
          </p>
        )}
      </div>
    </Link>
  )
}
