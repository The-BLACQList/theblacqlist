import type { EntityPageData } from '@/types'

/** One pin on the Visit map (ticket 190). The listing's own address is the primary pin. */
export interface LocationPin {
  id: string
  lat: number
  lng: number
  label: string
  primary: boolean
}

type PinSource = Pick<EntityPageData, 'id' | 'name' | 'details' | 'locations'>

/**
 * The main location first, then every other location that has coordinates.
 * Pure, so the Visit block and the tests read one rule.
 */
export function locationPins(entity: PinSource): LocationPin[] {
  const pins: LocationPin[] = []
  const { lat, lng } = entity.details
  if (lat != null && lng != null) {
    pins.push({ id: entity.id, lat, lng, label: `${entity.name} — main location`, primary: true })
  }
  for (const l of entity.locations ?? []) {
    if (l.lat != null && l.lng != null) {
      pins.push({ id: l.id, lat: l.lat, lng: l.lng, label: l.label, primary: false })
    }
  }
  return pins
}
