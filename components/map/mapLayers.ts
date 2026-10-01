import type { Map as MlMap } from 'maplibre-gl'
import type { LandmarkCollection } from '@/lib/map/landmarks'

export const INK = '#1d1c1d'
export const DOT_LAYERS = ['dots', 'clusters'] as const

/**
 * The GL layers: clusters as white circles with an ink ring and the count, and
 * every other listing as a small ink dot. Numbered photo pins are HTML markers
 * (a small, bounded set), and MapExplore keeps their ids out of this source so a
 * listing is never drawn twice.
 */
export function addListingLayers(map: MlMap): void {
  map.addSource('listings', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterRadius: 46,
    clusterMaxZoom: 12,
    promoteId: 'id',
  })
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'listings',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#ffffff',
      'circle-stroke-color': INK,
      'circle-stroke-width': 1.5,
      'circle-radius': ['step', ['get', 'point_count'], 15, 10, 19, 30, 25],
    },
  })
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'listings',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      // Jost has no glyph set on the basemap host, so the closest stock face.
      'text-font': ['Noto Sans Medium'],
      'text-size': 13,
    },
    paint: { 'text-color': INK },
  })
  map.addLayer({
    id: 'dots',
    type: 'circle',
    source: 'listings',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': 4,
      'circle-color': INK,
      'circle-opacity': 0.55,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 1.5,
    },
  })
}

const LANDMARK_ICON = 'landmark-diamond'
const LANDMARK_GOLD = [196, 160, 101] as const // #C4A065
const LANDMARK_HALO = '#efe5d3' // SAND.ground

/**
 * A small gold diamond with an ink edge, drawn into pixels here so the map needs
 * no extra asset or canvas. 2x density, so it is 12 CSS px wide.
 */
function landmarkDiamond(): { width: number; height: number; data: Uint8Array } {
  const size = 24
  const c = (size - 1) / 2
  const r = size / 2 - 1
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.abs(x - c) + Math.abs(y - c)
      const alpha = Math.min(1, Math.max(0, r - d + 0.5))
      if (alpha === 0) continue
      const edge = d > r - 2.5
      const i = (y * size + x) * 4
      data[i] = edge ? 29 : LANDMARK_GOLD[0]
      data[i + 1] = edge ? 28 : LANDMARK_GOLD[1]
      data[i + 2] = edge ? 29 : LANDMARK_GOLD[2]
      data[i + 3] = Math.round(alpha * 255)
    }
  }
  return { width: size, height: size, data }
}

/**
 * Our own landmarks: HBCUs and Black history and culture districts, from
 * lib/map/landmarks.ts. Added before the listing layers so listings draw on top,
 * and after the basemap so these win label collisions with its landmarks. They
 * are context, not content: nothing here is clickable or focusable.
 */
export function addLandmarkLayers(map: MlMap, data: LandmarkCollection): void {
  if (!map.hasImage(LANDMARK_ICON)) map.addImage(LANDMARK_ICON, landmarkDiamond(), { pixelRatio: 2 })
  map.addSource('landmarks', { type: 'geojson', data })
  map.addLayer({
    id: 'landmarks',
    type: 'symbol',
    source: 'landmarks',
    minzoom: 10,
    layout: {
      'icon-image': LANDMARK_ICON,
      'text-optional': true,
      'text-field': ['step', ['zoom'], '', 11, ['get', 'name']],
      'text-font': ['Noto Sans Medium'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11.5, 15, 14],
      'text-variable-anchor': ['left', 'right', 'top', 'bottom'],
      'text-radial-offset': 0.9,
      'text-justify': 'auto',
      'text-max-width': 9,
    },
    paint: {
      'text-color': INK,
      'text-halo-color': LANDMARK_HALO,
      'text-halo-width': 1.5,
    },
  })
}
