'use client'

import { cn } from '@/lib/utils'
import type { PhotoCandidate } from '@/lib/import/read-site'
import { MAX_PHOTOS_PER_IMPORT } from '@/lib/import/limits'
import type { ListingImageRole } from '@/lib/media/storeListingImage'
import { photoLimit } from '@/lib/stripe/features'
import { HINT_CLASS } from './shared'

// Step 0's photo grid (ticket 127). The owner picks what each photo is for:
// one logo, one cover, and as many page photos as Free allows. Nothing comes
// in until they tap "Use this". The images load straight from their own site.

export type PhotoRole = ListingImageRole | 'skip'
export type PhotoRoles = Record<string, PhotoRole>

/** New pages start on Free. */
export const GALLERY_MAX = Math.min(photoLimit('free') ?? 1, MAX_PHOTOS_PER_IMPORT - 2)

/** The site's suggested logo and cover start picked; everything else starts skipped. */
export function initialRoles(photos: readonly PhotoCandidate[], logo: string | null, cover: string | null): PhotoRoles {
  const roles: PhotoRoles = {}
  for (const p of photos) roles[p.url] = 'skip'
  if (logo && logo in roles) roles[logo] = 'logo'
  if (cover && cover in roles && cover !== logo) roles[cover] = 'cover'
  return roles
}

/** Sets one photo's role. A second logo or cover takes over from the first. */
export function setRole(roles: PhotoRoles, url: string, role: PhotoRole): PhotoRoles {
  const next = { ...roles }
  if (role === 'logo' || role === 'cover') {
    for (const key of Object.keys(next)) if (next[key] === role) next[key] = 'skip'
  }
  next[url] = role
  return next
}

const LABELS: Record<PhotoRole, string> = {
  skip: 'Skip',
  logo: 'Logo',
  cover: 'Cover',
  gallery: 'Page photo',
}

interface Props {
  photos: readonly PhotoCandidate[]
  roles: PhotoRoles
  onChange: (roles: PhotoRoles) => void
  /** Photos that would not load in the browser, hidden from the grid. */
  broken: ReadonlySet<string>
  onBroken: (url: string) => void
}

export function PhotoPicker({ photos, roles, onChange, broken, onBroken }: Props) {
  const shown = photos.filter((p) => !broken.has(p.url))
  const galleryCount = Object.values(roles).filter((r) => r === 'gallery').length
  const galleryFull = galleryCount >= GALLERY_MAX

  if (shown.length === 0) return null

  return (
    <fieldset className="min-w-0">
      <legend className="font-subhead text-base font-bold text-brand-black">Photos from your site</legend>
      <p id="qs-photo-hint" className={cn(HINT_CLASS, 'mt-1')}>
        Pick a logo, a cover, and {GALLERY_MAX === 1 ? 'one page photo' : `up to ${GALLERY_MAX} page photos`}.{' '}
        <span className="tabular-nums">
          {galleryCount} of {GALLERY_MAX} page {GALLERY_MAX === 1 ? 'photo' : 'photos'} on Free.
        </span>
        {galleryFull && ' More with Starter.'}
      </p>

      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map((photo, i) => {
          const role = roles[photo.url] ?? 'skip'
          const selectId = `qs-photo-${i}`
          return (
            <li
              key={photo.url}
              className={cn(
                'flex flex-col overflow-hidden rounded-xl border bg-white',
                role === 'skip' ? 'border-charcoal/20' : 'border-brand-black ring-1 ring-brand-black'
              )}
            >
              <div className={cn('aspect-[4/3] bg-charcoal/5', role === 'skip' && 'opacity-60')}>
                {/* Remote images from the owner's own site, shown before anything is saved. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.alt ?? ''}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() => {
                    if (role !== 'skip') onChange(setRole(roles, photo.url, 'skip'))
                    onBroken(photo.url)
                  }}
                  className={cn('h-full w-full', photo.kind === 'logo' ? 'object-contain p-3' : 'object-cover')}
                />
              </div>
              <label htmlFor={selectId} className="sr-only">
                Use photo {i + 1}
                {photo.alt ? ` (${photo.alt})` : ''} as
              </label>
              <select
                id={selectId}
                value={role}
                aria-describedby="qs-photo-hint"
                onChange={(e) => onChange(setRole(roles, photo.url, e.target.value as PhotoRole))}
                className="h-11 w-full border-t border-charcoal/15 bg-white px-2 font-subhead text-base text-brand-black focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-black"
              >
                {(['skip', 'logo', 'cover', 'gallery'] as const).map((r) => (
                  <option key={r} value={r} disabled={r === 'gallery' && galleryFull && role !== 'gallery'}>
                    {LABELS[r]}
                  </option>
                ))}
              </select>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}
