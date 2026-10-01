import { layers, namedFlavor } from '@protomaps/basemaps'
import type { StyleSpecification } from 'maplibre-gl'

/**
 * "Photo Pins" basemap: a warm sand ground so the photo pins and ink dots carry
 * all the contrast. No dark ground and no glow on the map itself. Protomaps
 * light flavor with the sand palette laid over it. Fully self-hosted tiles
 * (PMTiles in our own storage); fonts/sprites from the static basemaps-assets
 * bundle (TODO: copy into public/ for full self-hosting before scale).
 */
export const SAND = {
  ground: '#efe5d3',
  park: '#dfdfc6',
  minorRoad: '#f6efe2',
  majorRoad: '#fbf7ef',
  highway: '#e6cf9f',
  water: '#c9d9da',
  label: '#a0927c',
} as const

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
    water: SAND.water,
    minor_service: SAND.minorRoad,
    minor_a: SAND.minorRoad,
    minor_b: SAND.minorRoad,
    link: SAND.minorRoad,
    major: SAND.majorRoad,
    highway: SAND.highway,
    roads_label_minor: SAND.label,
    roads_label_major: SAND.label,
    subplace_label: SAND.label,
    city_label: SAND.label,
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
    // The photo pins are the points of interest, so the basemap's own POI
    // icons are dropped rather than competing with them.
    layers: layers('protomaps', flavor, { lang: 'en' }).filter((l) => l.id !== 'pois'),
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
