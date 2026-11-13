import { Clock, Globe, MapPin, Phone, Tag } from 'lucide-react'

import { cn } from '@/lib/utils'

// The live page beside the questions (ticket 126). Used by the /add-business
// quick start and the finish view, new and edit mode (ticket 129), so it takes
// plain values and knows nothing about either screen's state. It mirrors the
// public page's hero and About block; it is not the real EntityPage, which needs
// a saved, fully loaded listing.

/** Contact lines for the full preview, already in words. Empty values are left out. */
export interface PreviewContact {
  phone: string | null
  /** The website's host, e.g. "glowsalon.com". */
  website: string | null
  address: string | null
  /** From summarizeHours, e.g. "Mon–Fri 9am–5pm". */
  hoursLine: string | null
  /** Names of the networks linked, e.g. "Instagram". */
  socials: string[]
}

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
  /** Extra buttons the page shows, in order (part B). Left out on a new page. */
  extraLabels?: string[]
  coverUrl?: string | null
  /** The part the current question fills in, outlined so the owner sees it change. */
  highlight?: PreviewPart | null
  /** Phones: the hero only, so the question stays on screen. */
  compact?: boolean
  /** Gallery photos, first few only (edit page). Left out on a new page. */
  photoUrls?: string[]
  /** Contact details (edit page), so an import shows up beside the form. */
  contact?: PreviewContact
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
  extraLabels = [],
  coverUrl,
  highlight = null,
  compact = false,
  photoUrls = [],
  contact,
}: Props) {
  const contactLines = contact
    ? ([
        [MapPin, contact.address],
        [Clock, contact.hoursLine],
        [Phone, contact.phone],
        [Globe, contact.website],
      ] as const).filter((line): line is readonly [typeof MapPin, string] => Boolean(line[1]))
    : []
  return (
    <div
      className="overflow-hidden rounded-2xl border border-charcoal/10 bg-white shadow-sm"
      aria-label="Preview of your page"
      role="group"
    >
      <div
        className={cn(
          // Grows with a long name instead of pushing it up under the badge.
          'relative flex w-full flex-col justify-end overflow-hidden bg-gradient-to-br from-charcoal/70 to-brand-black',
          compact ? 'min-h-[132px]' : 'min-h-[220px]'
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
        <div className={cn('relative', compact ? 'px-4 pt-11 pb-3' : 'px-5 pt-12 pb-5')}>
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
                !tagline && 'text-white/60',
                mark(highlight === 'tagline')
              )}
            >
              {tagline || 'Your one line shows here.'}
            </p>
          )}
          {!compact && (
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={cn(
                  'inline-flex h-10 items-center rounded-full px-5 font-subhead text-sm font-bold',
                  ctaLabel
                    ? 'bg-amber-gold text-brand-black'
                    : 'border border-dashed border-white/50 text-white/60',
                  mark(highlight === 'cta')
                )}
              >
                {ctaLabel ?? 'Your main button'}
              </span>
              {extraLabels.map((label, i) => (
                <span
                  key={`${i}-${label}`}
                  className="inline-flex h-10 items-center rounded-full border border-white/60 px-5 font-subhead text-sm font-bold text-white"
                >
                  {label}
                </span>
              ))}
            </div>
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
          {photoUrls.length > 0 && (
            <div>
              <p className="font-headline text-base text-brand-black">Photos</p>
              <ul className="mt-2 grid grid-cols-4 gap-1.5">
                {photoUrls.slice(0, 4).map((url) => (
                  <li key={url} className="aspect-square overflow-hidden rounded-md bg-charcoal/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(contactLines.length > 0 || (contact?.socials.length ?? 0) > 0) && (
            <div>
              <p className="font-headline text-base text-brand-black">Contact</p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {contactLines.map(([Icon, text]) => (
                  <li key={text} className="flex items-start gap-2 font-body text-sm text-charcoal">
                    <Icon className="mt-0.5 size-3.5 shrink-0 text-charcoal-soft" aria-hidden="true" />
                    <span className="min-w-0 break-words">{text}</span>
                  </li>
                ))}
              </ul>
              {contact && contact.socials.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {contact.socials.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center rounded-full border border-charcoal/15 px-2.5 py-0.5 font-subhead text-[11px] font-semibold text-charcoal"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
