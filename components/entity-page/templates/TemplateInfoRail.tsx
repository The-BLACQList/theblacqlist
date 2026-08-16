import type { EntityPageData, LocationType } from '@/types'
import { OpenStatus } from '@/components/entity-page/templates/OpenStatus'

interface Props {
  entity: EntityPageData
}

/**
 * The fulfillment note in the rail, keyed by the six live
 * `listings.location_type` values (migration 20260524000001). An empty string
 * means the rail says nothing — a storefront's location is already the city
 * line above it.
 *
 * Typed exhaustively over LocationType rather than `Record<string, string>`:
 * the loose signature let three PRE-migration keys ('online',
 * 'virtual-services', 'ships-nationwide') sit here unnoticed since May, matching
 * no row, while every value the DB actually serves fell through to no note at
 * all. It also required an `as string` cast at the lookup, which is the tell.
 * Fixed 2026-08-15.
 */
const LOCATION_NOTES: Record<LocationType, string> = {
  physical: '',
  virtual: 'Online only',
  hybrid: 'In person & virtual',
  service_area: 'Comes to you',
  national: 'Ships nationwide',
  traveling: 'Mobile / pop-up',
}

/**
 * Quick-info rail (Living Commerce Index anatomy ③): the at-a-glance facts
 * directly under the sticky tabs — rating, neighborhood, fulfillment.
 */
export function TemplateInfoRail({ entity }: Props) {
  const items: string[] = []

  if (entity.avg_rating !== null && entity.review_count > 0) {
    items.push(`★ ${entity.avg_rating.toFixed(1)} · ${entity.review_count.toLocaleString()} review${entity.review_count === 1 ? '' : 's'}`)
  }
  if (entity.city) items.push(`${entity.city.name}, ${entity.city.state_abbr}`)
  const locationNote = LOCATION_NOTES[entity.location_type]
  if (locationNote) items.push(locationNote)
  // The details flag is a separate opt-in, so guard against saying it twice —
  // 'national' is the location_type that already carries the same sentence.
  if (entity.details.ships_nationwide && entity.location_type !== 'national') {
    items.push('Ships nationwide')
  }

  const hasHours = Boolean(entity.details.hours)
  if (items.length === 0 && !hasHours) return null

  return (
    <div className="bg-off-white border-b border-charcoal/10">
      <div className="max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10">
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-1.5 py-3 list-none m-0 p-0">
          {hasHours && (
            <li className="flex items-center">
              <OpenStatus hours={entity.details.hours} surface="light" className="text-[13.5px]" />
            </li>
          )}
          {items.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 font-subhead text-[13.5px] text-charcoal"
            >
              <span className="size-1.5 rounded-full bg-amber shrink-0" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
