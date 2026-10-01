import type { Map as MlMap } from 'maplibre-gl'

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
