import type { EntityPageData } from '@/types'
import { getEntityCtaLabel } from '@/components/entity-page/templates/cta'
import type { ChapterDef, Photo } from './model'
import { STOREFRONT_PRESET, type StorefrontPreset } from './presets'

/**
 * The Storefront preset for a real listing (ticket 231). The sample pages take
 * their photos, glance line and chapter list from presets.ts; a live listing
 * builds the same shape from its own data (founder, 2026-11-18: no new owner
 * settings). Chapters with nothing to show drop out of the page and the nav.
 */

/** The listing's gallery minus the cover, without repeats, in gallery order. */
function spare(entity: EntityPageData): Photo[] {
  const seen = new Set<string>()
  if (entity.cover_image_path) seen.add(entity.cover_image_path)
  const out: Photo[] = []
  for (const g of entity.images) {
    if (seen.has(g.src)) continue
    seen.add(g.src)
    out.push({ src: g.src, alt: g.alt })
  }
  return out
}

/** "Est. 2014" and the first attribute values, three at most. */
function glanceFor(entity: EntityPageData): string[] {
  const out: string[] = []
  const year = entity.details.founded_year
  if (year) out.push(`Est. ${year}`)
  for (const a of entity.attributes) {
    for (const v of a.values) {
      if (out.length >= 3) return out
      out.push(v.name)
    }
  }
  return out
}

/** The Visit chapter's second band, in the sample's words, for the parts this listing has. */
function findLede(entity: EntityPageData): string {
  const parts = [
    entity.locations?.length ? 'visit another location' : null,
    entity.findUsAt?.length ? 'find us in local shops' : null,
    entity.orderLinks?.length ? 'order for delivery' : null,
  ].filter((x): x is string => x !== null)
  if (!parts.length) return ''
  const text = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} or ${parts.at(-1)}` : parts[0]!
  return `${text[0]!.toUpperCase()}${text.slice(1)}.`
}

export function liveStorefrontPreset(entity: EntityPageData): StorefrontPreset {
  const d = entity.details
  const photos = spare(entity)
  const at = (i: number) => photos[i] ?? null
  const restaurant = entity.entity_type === 'restaurant'

  const hasVisit = Boolean(
    d.address ||
    d.hours ||
    entity.locations?.length ||
    entity.findUsAt?.length ||
    entity.orderLinks?.length
  )
  const hasServices = Boolean(d.services?.length)
  const hasDeals = Boolean(entity.deals?.length)

  const chapters: ChapterDef[] = [
    { id: 'welcome', nav: 'Welcome', title: 'Welcome' },
    ...(hasVisit ? [{ id: 'visit', nav: 'Visit', title: 'Hours and Location' }] : []),
    ...(hasServices
      ? [
          restaurant
            ? { id: 'menu', nav: 'Menu', title: 'The Menu' }
            : { id: 'menu', nav: 'Offerings', title: 'What We Offer' },
        ]
      : hasDeals
        ? // Deals but no menu: the chapter is just the offers, named for them.
          [{ id: 'menu', nav: 'Offers', title: 'Offers' }]
        : []),
    { id: 'gallery', nav: 'Gallery', title: 'Gallery' },
    { id: 'reviews', nav: 'Reviews', title: 'Reviews' },
    { id: 'more', nav: 'More', title: 'More' },
  ]

  return {
    chapters,
    aspect: {},
    glance: glanceFor(entity),
    neighbourhood: [entity.city?.name, entity.city?.state_abbr].filter(Boolean).join(', '),
    cta: getEntityCtaLabel(entity),
    // The hero photo is decorative here: the name and story sit right on it.
    coverAlt: '',
    duo: [at(0), at(1)].filter((p): p is Photo => p !== null),
    interludes: [at(2), at(4), at(5)],
    menuPhoto: at(3),
    offersLede: 'Current offers from the business.',
    booking: { title: '', facts: [], action: '' },
    findLede: findLede(entity),
    map: STOREFRONT_PRESET.map,
  }
}
