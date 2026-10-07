import { MapPin, Tag } from 'lucide-react'

import { cn } from '@/lib/utils'

// The live page beside the questions (ticket 126). Used by the /add-business
// quick start and the finish view, new and edit mode (ticket 129), so it takes
// plain values and knows nothing about either screen's state. It mirrors the
// public page's hero and About block; it is not the real EntityPage, which needs
// a saved, fully loaded listing.

export type PreviewPart = 'name' | 'tagline' | 'about' | 'category' | 'location' | 'cta' | 'owner'

interface Props {
  name: string
  tagline: string
  description: string
  categoryName: string | null
  locationLabel: string | null
  /** "Black-Owned" or "Ally", or null before the owner picks. */
  ownershipLabel: string | null
  /** The main button's text, or null before the owner picks. */
  ctaLabel: string | null
  coverUrl?: string | null
  /** The part the current question fills in, outlined so the owner sees it change. */
  highlight?: PreviewPart | null
  /** Phones: the hero only, so the question stays on screen. */
  compact?: boolean
}

function mark(on: boolean): string {
  return on ? 'outline outline-2 outline-offset-4 outline-amber-gold rounded-sm' : ''
}

export function LivePagePreview({
  name,
  tagline,
  description,
  categoryName,
  locationLabel,
  ownershipLabel,
  ctaLabel,
  coverUrl,
  highlight = null,
  compact = false,
}: Props) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-charcoal/10 bg-white shadow-sm"
      aria-label="Preview of your page"
      role="group"
    >
      <div
        className={cn(
          'relative w-full overflow-hidden bg-gradient-to-br from-charcoal/70 to-brand-black',
          compact ? 'h-[132px]' : 'h-[220px]'
        )}
      >
        {coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.75) 100%)',
          }}
          aria-hidden="true"
        />
        {ownershipLabel && (
          <span
            className={cn(
              'absolute top-3 left-3 inline-flex items-center rounded-full bg-white/90 px-2.5 py-1 font-subhead text-[11px] font-bold uppercase tracking-wider text-brand-black',
              mark(highlight === 'owner')
            )}
          >
            {ownershipLabel}
          </span>
        )}
        <div className={cn('absolute inset-x-0 bottom-0', compact ? 'px-4 pb-3' : 'px-5 pb-5')}>
          <p
            className={cn(
              'font-headline leading-tight text-white break-words',
              compact ? 'text-xl' : 'text-[28px]',
              !name && 'text-white/60',
              mark(highlight === 'name')
            )}
          >
            {name || 'Your business name'}
          </p>
          {(tagline || !compact) && (
            <p
              className={cn(
                'mt-1 font-body text-sm text-white/80 line-clamp-2',
                !tagline && 'text-white/45',
                mark(highlight === 'tagline')
              )}
            >
              {tagline || 'Your one line shows here.'}
            </p>
          )}
          {!compact && (
            <span
              className={cn(
                'mt-3 inline-flex h-10 items-center rounded-full px-5 font-subhead text-sm font-bold',
                ctaLabel
                  ? 'bg-amber-gold text-brand-black'
                  : 'border border-dashed border-white/50 text-white/60',
                mark(highlight === 'cta')
              )}
            >
              {ctaLabel ?? 'Your main button'}
            </span>
          )}
        </div>
      </div>

      {!compact && (
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full bg-pale-lavender px-3 py-1 font-subhead text-xs text-charcoal',
                !categoryName && 'text-charcoal-faint',
                mark(highlight === 'category')
              )}
            >
              <Tag className="size-3.5" aria-hidden="true" />
              {categoryName ?? 'Category'}
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full bg-pale-lavender px-3 py-1 font-subhead text-xs text-charcoal',
                !locationLabel && 'text-charcoal-faint',
                mark(highlight === 'location')
              )}
            >
              <MapPin className="size-3.5" aria-hidden="true" />
              {locationLabel ?? 'Where'}
            </span>
          </div>
          <div className={mark(highlight === 'about')}>
            <p className="font-headline text-base text-brand-black">About</p>
            <p
              className={cn(
                'mt-1 font-body text-sm leading-relaxed text-charcoal whitespace-pre-line break-words',
                !description && 'text-charcoal-faint'
              )}
            >
              {description || 'What you do, in your own words.'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
