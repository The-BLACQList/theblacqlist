import Link from 'next/link'
import { projectUS } from '@/lib/map/albers'
import { INK } from '@/components/map/mapLayers'
import { US_LAND_PATH, US_STATE_BORDERS_PATH, US_VIEWBOX } from '@/components/home/usOutline'

const { width: W, height: H } = US_VIEWBOX
// SAND.ground in components/map/mapStyle.ts. Copied, not imported, so the
// homepage never loads the basemap style code.
const GROUND = '#efe5d3'

type DotSize = 'cluster' | 'group' | 'pin'

/**
 * The dots on the picture. Illustration only: they are not our listings and
 * carry no counts or names. [Decision — founder, 2026-10-14: the band should
 * "just illustrate the point", not read as a census of the cities we cover
 * today.] Spread coast to coast, a little thicker in the South and East.
 */
export const BAND_DOTS: Array<{ lng: number; lat: number; size: DotSize }> = [
  // Clusters
  { lng: -84.39, lat: 33.75, size: 'cluster' },
  { lng: -74.0, lat: 40.71, size: 'cluster' },
  { lng: -87.63, lat: 41.88, size: 'cluster' },
  { lng: -95.37, lat: 29.76, size: 'cluster' },
  { lng: -118.24, lat: 34.05, size: 'cluster' },
  // Groups
  { lng: -77.04, lat: 38.9, size: 'group' },
  { lng: -83.05, lat: 42.33, size: 'group' },
  { lng: -96.8, lat: 32.78, size: 'group' },
  { lng: -90.05, lat: 35.15, size: 'group' },
  { lng: -80.84, lat: 35.23, size: 'group' },
  { lng: -90.07, lat: 29.95, size: 'group' },
  { lng: -122.27, lat: 37.8, size: 'pin' },
  { lng: -80.19, lat: 25.76, size: 'group' },
  { lng: -90.2, lat: 38.63, size: 'group' },
  // Pins
  { lng: -86.8, lat: 33.52, size: 'pin' },
  { lng: -90.18, lat: 32.3, size: 'pin' },
  { lng: -81.1, lat: 32.08, size: 'pin' },
  { lng: -81.66, lat: 30.33, size: 'pin' },
  { lng: -82.46, lat: 27.95, size: 'pin' },
  { lng: -81.38, lat: 28.54, size: 'pin' },
  { lng: -81.03, lat: 34.0, size: 'pin' },
  { lng: -78.64, lat: 35.78, size: 'pin' },
  { lng: -77.44, lat: 37.54, size: 'pin' },
  { lng: -76.29, lat: 36.85, size: 'pin' },
  { lng: -86.78, lat: 36.16, size: 'pin' },
  { lng: -85.76, lat: 38.25, size: 'pin' },
  { lng: -84.51, lat: 39.1, size: 'pin' },
  { lng: -81.69, lat: 41.5, size: 'pin' },
  { lng: -82.99, lat: 39.96, size: 'pin' },
  { lng: -86.16, lat: 39.77, size: 'pin' },
  { lng: -87.91, lat: 43.04, size: 'pin' },
  { lng: -93.27, lat: 44.98, size: 'pin' },
  { lng: -94.58, lat: 39.1, size: 'pin' },
  { lng: -97.52, lat: 35.47, size: 'pin' },
  { lng: -98.49, lat: 29.42, size: 'pin' },
  { lng: -97.74, lat: 30.27, size: 'pin' },
  { lng: -93.75, lat: 32.52, size: 'pin' },
  { lng: -92.29, lat: 34.75, size: 'pin' },
  { lng: -86.3, lat: 32.37, size: 'pin' },
  { lng: -91.15, lat: 30.45, size: 'pin' },
  { lng: -88.04, lat: 30.69, size: 'pin' },
  { lng: -81.97, lat: 33.47, size: 'pin' },
  { lng: -83.63, lat: 32.84, size: 'pin' },
  { lng: -79.79, lat: 36.07, size: 'pin' },
  { lng: -84.28, lat: 30.44, size: 'pin' },
  { lng: -75.17, lat: 39.95, size: 'pin' },
  { lng: -76.61, lat: 39.29, size: 'pin' },
  { lng: -79.99, lat: 40.44, size: 'pin' },
  { lng: -78.88, lat: 42.89, size: 'pin' },
  { lng: -71.06, lat: 42.36, size: 'pin' },
  { lng: -95.94, lat: 41.26, size: 'pin' },
  { lng: -104.99, lat: 39.74, size: 'pin' },
  { lng: -106.65, lat: 35.08, size: 'pin' },
  { lng: -112.07, lat: 33.45, size: 'group' },
  { lng: -115.14, lat: 36.17, size: 'pin' },
  { lng: -111.89, lat: 40.76, size: 'pin' },
  { lng: -117.16, lat: 32.72, size: 'pin' },
  { lng: -121.49, lat: 38.58, size: 'pin' },
  { lng: -122.68, lat: 45.52, size: 'pin' },
  { lng: -122.33, lat: 47.61, size: 'pin' },
]

const RADIUS: Record<DotSize, number> = { cluster: 20, group: 14, pin: 7 }
// Pins first, so the bigger circles sit on top where they touch.
const ORDER: Record<DotSize, number> = { pin: 0, group: 1, cluster: 2 }

const dots = BAND_DOTS.map((d) => {
  const [x, y] = projectUS(d.lng, d.lat)
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, r: RADIUS[d.size], size: d.size }
}).sort((a, b) => ORDER[a.size] - ORDER[b.size])

/**
 * Homepage map section (PR 3): a still picture of the country dotted the way
 * /map draws its clusters, so the page it links to looks familiar.
 * Server-rendered SVG, no map library, no data and no motion.
 * [Decision — tester feedback, 2026-10-14: "Would have loved to know earlier
 * there was a map."]
 */
export function HomeMapBand() {
  return (
    <section aria-labelledby="map-band-heading" className="bg-white py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        <div className="lg:col-span-4">
          <p className="font-subhead text-xs font-bold uppercase tracking-[0.12em] text-amber mb-1.5">
            The map
          </p>
          <h2
            id="map-band-heading"
            className="font-headline text-[clamp(1.75rem,1.2rem+2vw,2.5rem)] leading-tight text-brand-black text-balance"
          >
            See every business on the map
          </h2>
          <p className="font-body text-[15px] text-charcoal mt-3 max-w-[44ch] text-pretty">
            Find Black-owned businesses near you or wherever you are headed. Start from the
            whole country, then zoom in.
          </p>
          <Link
            href="/map"
            className="inline-flex items-center justify-center h-12 px-7 mt-6 rounded-full bg-brand-black hover:bg-charcoal text-white font-subhead text-sm font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          >
            Open the map
            <span aria-hidden="true" className="ml-2">→</span>
          </Link>
        </div>

        {/* A picture only. It repeats the button's link for anyone who taps it,
            but stays out of the tab order and the reading order. */}
        <div aria-hidden="true" className="lg:col-span-8 -mx-5 md:mx-0">
          <Link href="/map" tabIndex={-1} className="block">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" focusable="false">
              <path d={US_LAND_PATH} fill={GROUND} />
              <path d={US_STATE_BORDERS_PATH} fill="none" stroke="#ffffff" strokeWidth={1.5} strokeLinejoin="round" />
              {dots.map((d, i) =>
                d.size === 'pin' ? (
                  <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={INK} stroke={GROUND} strokeWidth={2} />
                ) : (
                  <g key={i}>
                    <circle cx={d.x} cy={d.y} r={d.r} fill="#ffffff" stroke={INK} strokeWidth={3} />
                    <circle cx={d.x} cy={d.y} r={d.size === 'cluster' ? 6 : 4.5} fill={INK} />
                  </g>
                )
              )}
            </svg>
          </Link>
        </div>
      </div>
    </section>
  )
}
