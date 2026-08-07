import type { EntityPageData } from '@/types'
import { OpenStatus } from '@/components/entity-page/templates/OpenStatus'

interface Props {
  entity: EntityPageData
}

const LOCATION_NOTES: Record<string, string> = {
  online: 'Online',
  'virtual-services': 'Virtual available',
  'ships-nationwide': 'Ships nationwide',
  hybrid: 'In person & virtual',
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
  const locationNote = LOCATION_NOTES[entity.location_type as string]
  if (locationNote) items.push(locationNote)
  if (entity.details.ships_nationwide && entity.location_type !== 'ships-nationwide') {
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
