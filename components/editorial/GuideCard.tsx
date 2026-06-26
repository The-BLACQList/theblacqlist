import Link from 'next/link'
import { MapPin, BookOpen } from 'lucide-react'

interface Props {
  title: string
  slug: string
  subtitle?: string | null
  city?: string | null
  sectionCount?: number
}

export function GuideCard({ title, slug, subtitle, city, sectionCount }: Props) {
  return (
    <Link
      href={`/guides/${slug}`}
      className="group flex flex-col gap-3 rounded-xl border border-charcoal/10 bg-white p-5 hover:border-amber-gold/40 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="size-9 rounded-lg bg-pale-lavender flex items-center justify-center flex-shrink-0">
          <BookOpen className="size-4 text-amber" aria-hidden="true" />
        </div>
        {sectionCount !== undefined && (
          <span className="font-subhead text-xs text-charcoal-soft shrink-0">
            {sectionCount} {sectionCount === 1 ? 'section' : 'sections'}
          </span>
        )}
      </div>
      <div>
        <h2 className="font-headline text-base text-brand-black group-hover:text-amber transition-colors leading-snug">
          {title}
        </h2>
        {subtitle && (
          <p className="font-body text-sm text-charcoal-soft leading-relaxed mt-1 line-clamp-2">
            {subtitle}
          </p>
        )}
        {city && (
          <span className="inline-flex items-center gap-1 mt-2 font-subhead text-xs text-charcoal-soft">
            <MapPin className="size-3" aria-hidden="true" />
            {city}
          </span>
        )}
      </div>
    </Link>
  )
}
