import { layers, namedFlavor } from '@protomaps/basemaps'
import type { StyleSpecification } from 'maplibre-gl'

/**
 * Light, legible basemap (founder direction: "a map that looks more like a
 * map — easy to see, scan, and traverse my neighborhood"). Protomaps light
 * flavor tinted to brand neutrals; brand color lives in the pins and chrome,
 * not the ground. Fully self-hosted tiles (PMTiles in our own storage);
 * fonts/sprites from the static basemaps-assets bundle (TODO: copy into
 * public/ for full self-hosting before scale).
 */
export function buildMapStyle(tilesUrl: string): StyleSpecification {
  const flavor = {
    ...namedFlavor('light'),
    background: '#f2f0ee', // pale-lavender ground
    earth: '#f4f4f7', // off-white
    // Founder: state lines must read clearly — darken admin boundaries and
    // state labels from the flavor's faint greys to legible warm charcoal.
    boundaries: '#8a8175',
    state_label: '#6b6255',
    state_label_halo: '#f4f4f7',
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
    layers: layers('protomaps', flavor, { lang: 'en' }),
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
