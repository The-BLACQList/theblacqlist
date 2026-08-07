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
  }

  return {
    version: 8,
    glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
    sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${tilesUrl}`,
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    layers: layers('protomaps', flavor, { lang: 'en' }),
  }
}

/** City fly-to targets (matches cities.latitude/longitude seeds). */
export const CITY_VIEWS: Record<string, { center: [number, number]; zoom: number; label: string }> =
  {
    'atlanta-ga': { center: [-84.388, 33.749], zoom: 11, label: 'Atlanta' },
    'houston-tx': { center: [-95.3698, 29.7604], zoom: 10.6, label: 'Houston' },
    'chicago-il': { center: [-87.6298, 41.8781], zoom: 10.8, label: 'Chicago' },
  }
