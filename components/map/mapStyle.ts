import { layers, namedFlavor } from '@protomaps/basemaps'
import type { LayerSpecification, StyleSpecification, SymbolLayerSpecification } from 'maplibre-gl'

/**
 * "Photo Pins" basemap: a warm sand ground so the photo pins and ink dots carry
 * all the contrast. No dark ground and no glow on the map itself. Protomaps
 * light flavor with the sand palette laid over it. Parks, water, campuses and
 * buildings each get their own step on that palette, and the labels have a
 * hierarchy (neighborhoods over major roads over minor roads), so people can
 * find their way by what they already know. Fully self-hosted tiles
 * (PMTiles in our own storage); fonts/sprites from the static basemaps-assets
 * bundle (TODO: copy into public/ for full self-hosting before scale).
 */
export const SAND = {
  ground: '#efe5d3',
  park: '#d3dbb4',
  minorRoad: '#f6efe2',
  majorRoad: '#fbf7ef',
  highway: '#e6cf9f',
  water: '#bcd3d6',
  buildings: '#e2d5bf',
  campus: '#eadcc2',
  hospital: '#ecdacf',
  industrial: '#e4dccb',
  pedestrian: '#f3ebdc',
  aerodrome: '#e6dccb',
  railway: '#b5a68e',
  label: '#a0927c',
  majorLabel: '#7d705c',
  placeLabel: '#6e6150',
  cityLabel: '#5a4e3f',
} as const

/** Landmark label inks: one warm ink, with green space in a muted green. */
export const LANDMARK_INK = '#5a4e3f'
export const LANDMARK_GREEN = '#4d6a3c'

/**
 * The basemap points we keep: places people navigate by. Restaurants, shops,
 * schools, bus stops and the like are left out because our listings are the
 * businesses on this map, and those would compete with them.
 */
export const LANDMARK_KINDS = [
  'park',
  'garden',
  'zoo',
  'stadium',
  'university',
  'museum',
  'attraction',
  'theatre',
  'library',
  'townhall',
  'aerodrome',
  'station',
  'marina',
  'beach',
] as const

const GREEN_KINDS = ['park', 'garden', 'zoo', 'marina', 'beach']

/** The stock POI layer, narrowed to landmarks and sized for city zooms. */
function landmarkPois(layer: SymbolLayerSpecification): SymbolLayerSpecification {
  return {
    ...layer,
    filter: [
      'all',
      ['in', ['get', 'kind'], ['literal', [...LANDMARK_KINDS]]],
      ['>=', ['zoom'], ['get', 'min_zoom']],
    ],
    layout: {
      ...layer.layout,
      'text-size': ['interpolate', ['linear'], ['zoom'], 12, 11, 15, 13, 18, 15],
      'symbol-sort-key': ['get', 'min_zoom'],
    },
    paint: {
      ...layer.paint,
      'text-color': ['case', ['in', ['get', 'kind'], ['literal', GREEN_KINDS]], LANDMARK_GREEN, LANDMARK_INK],
      'text-halo-color': SAND.ground,
      'text-halo-width': 1.2,
      'icon-opacity': 0.85,
    },
  }
}

export function buildMapStyle(tilesUrl: string): StyleSpecification {
  const base = namedFlavor('light')
  const flavor = {
    ...base,
    background: SAND.ground,
    earth: SAND.ground,
    park_a: SAND.park,
    park_b: SAND.park,
    wood_a: SAND.park,
    wood_b: SAND.park,
    scrub_a: SAND.park,
    scrub_b: SAND.park,
    zoo: SAND.park,
    water: SAND.water,
    buildings: SAND.buildings,
    school: SAND.campus,
    hospital: SAND.hospital,
    industrial: SAND.industrial,
    pedestrian: SAND.pedestrian,
    aerodrome: SAND.aerodrome,
    railway: SAND.railway,
    minor_service: SAND.minorRoad,
    minor_a: SAND.minorRoad,
    minor_b: SAND.minorRoad,
    link: SAND.minorRoad,
    major: SAND.majorRoad,
    highway: SAND.highway,
    roads_label_minor: SAND.label,
    roads_label_major: SAND.majorLabel,
    subplace_label: SAND.placeLabel,
    city_label: SAND.cityLabel,
    ocean_label: SAND.label,
    country_label: SAND.label,
    roads_label_minor_halo: SAND.ground,
    roads_label_major_halo: SAND.ground,
    subplace_label_halo: SAND.ground,
    city_label_halo: SAND.ground,
    // Founder: state lines must read clearly. Kept a step darker than the
    // place labels so they still read on sand.
    boundaries: '#8a8175',
    state_label: '#7d705c',
    state_label_halo: SAND.ground,
  }

  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
    sources: {
      protomaps: {
        type: 'vector',
        // Explicit tile template (not the TileJSON `url:` form): sidesteps a
        // pmtiles/maplibre metadata handshake stall observed in the wild.
        tiles: [`pmtiles://${tilesUrl}/{z}/{x}/{y}`],
        minzoom: 0,
        maxzoom: 14,
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    // Landmarks only. Our own landmark list and the listings are added on top
    // at runtime, so they win any label collision with these.
    layers: layers('protomaps', flavor, { lang: 'en' }).map(
      (l): LayerSpecification => (l.id === 'pois' && l.type === 'symbol' ? landmarkPois(l) : l)
    ),
  }
}

/**
 * City fly-to targets (matches cities.latitude/longitude seeds).
 *
 * Centers are copied verbatim from `supabase/seed.sql` so the map lands where
 * the database says the city is. Zooms are set against the *measured* bounding
 * box of each city's seeded listings — see the geocode dry-run report in
 * `docs/blacqlist/data/` — rather than guessed from the city's nominal size, so
 * a tight corpus isn't framed as if it filled the metro.
 *
 * Los Angeles is the case where those two disagree: its seeded center is
 * downtown, but the listings cluster southwest (Leimert Park, Crenshaw, Baldwin
 * Hills). 10.2 covers the whole 0.143° × 0.159° span from that offset center.
 */
export const CITY_VIEWS: Record<string, { center: [number, number]; zoom: number; label: string }> =
  {
    'atlanta-ga': { center: [-84.388, 33.749], zoom: 11, label: 'Atlanta' },
    'houston-tx': { center: [-95.3698, 29.7604], zoom: 10.6, label: 'Houston' },
    'chicago-il': { center: [-87.6298, 41.8781], zoom: 10.8, label: 'Chicago' },
    'los-angeles-ca': { center: [-118.243683, 34.052235], zoom: 10.2, label: 'Los Angeles' },
    'washington-dc': { center: [-77.036873, 38.907192], zoom: 11.2, label: 'Washington DC' },
    'new-orleans-la': { center: [-90.071533, 29.951065], zoom: 10.9, label: 'New Orleans' },
  }
