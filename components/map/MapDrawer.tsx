'use client'

import { MapBottomSheet } from '@/components/map/MapBottomSheet'
import { MapPanel } from '@/components/map/MapPanel'
import type { MapFilterProps, MapResultsProps } from '@/lib/map/types'

interface Props extends MapFilterProps, MapResultsProps {
  isDesktop: boolean
  /** side = docked beside the map (desktop). overlay = floats over it (phone). */
  slot: 'side' | 'overlay'
  cityTotal: number
  reduceMotion: boolean
}

/**
 * Picks the results surface for the viewport: the docked panel at lg and up,
 * the bottom sheet below. Only one is mounted, so the cards never render twice.
 * MapExplore mounts this twice, once beside the map and once over it; the slot
 * decides which of the two actually renders. On phones the filters live in the
 * floating bar (MapPhoneBar), not here.
 */
export function MapDrawer({ isDesktop, slot, ...props }: Props) {
  if (isDesktop && slot === 'side') return <MapPanel {...props} />
  if (!isDesktop && slot === 'overlay') return <MapBottomSheet {...props} />
  return null
}
