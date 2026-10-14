import Link from 'next/link'
import { projectUS } from '@/lib/map/albers'
import { INK } from '@/components/map/mapLayers'
import { US_LAND_PATH, US_STATE_BORDERS_PATH, US_VIEWBOX } from '@/components/home/usOutline'

export interface MapBandCity {
  name: string
  slug: string
  count: number
  isActive: boolean
  lat: number | null
  lng: number | null
}

interface Props {
  cities: MapBandCity[]
}

const { width: W, height: H } = US_VIEWBOX
// SAND.ground in components/map/mapStyle.ts. Copied, not imported, so the
// homepage never loads the basemap style code.
const GROUND = '#efe5d3'
const LABEL_SIZE = 26
const COUNT_SIZE = 24

/** Radius in viewBox units. Area tracks the count, with a floor so small cities still read. */
export function dotRadius(count: number): number {
  return Math.round((18 + Math.sqrt(count) * 1.6) * 10) / 10
}

interface Placed extends MapBandCity {
  x: number
  y: number
}

function place(cities: MapBandCity[]): Placed[] {
  const placed: Placed[] = []
  for (const c of cities) {
    if (c.lat == null || c.lng == null) continue
    const [x, y] = projectUS(c.lng, c.lat)
    // Alaska, Hawaii and the territories fall off the outline. Leave them out
    // of the drawing; the text list below still names them.
    if (x < 0 || x > W || y < 0 || y > H) continue
    placed.push({ ...c, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 })
  }
  return placed
}

const SOON_RADIUS = 12
const LABEL_GAP = 8

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface LabelSpot {
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
  box: Box
}

export interface Circle {
  x: number
  y: number
  r: number
}

function hitsCircle(b: Box, c: Circle): boolean {
  const dx = c.x - Math.max(b.x0, Math.min(c.x, b.x1))
  const dy = c.y - Math.max(b.y0, Math.min(c.y, b.y1))
  return dx * dx + dy * dy < c.r * c.r
}

function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
}

/**
 * Where each live city's name goes: right of its dot, else left, below or
 * above, taking the first spot that stays on the picture and clears every
 * other dot and every name already placed. Biggest cities are placed first.
 * Houston's name, for one, would otherwise run over New Orleans.
 */
export function placeLabels<T extends Circle & { name: string }>(
  live: T[],
  others: Circle[]
): Array<T & { label: LabelSpot }> {
  const circles = [...live, ...others]
  const taken: Box[] = []
  return live.map((c) => {
    const w = c.name.length * LABEL_SIZE * 0.56
    const h = LABEL_SIZE
    const d = c.r + LABEL_GAP
    const right: LabelSpot = {
      x: c.x + d,
      y: c.y,
      anchor: 'start',
      box: { x0: c.x + d, y0: c.y - h / 2, x1: c.x + d + w, y1: c.y + h / 2 },
    }
    const options: LabelSpot[] = [
      right,
      { x: c.x - d, y: c.y, anchor: 'end', box: { x0: c.x - d - w, y0: c.y - h / 2, x1: c.x - d, y1: c.y + h / 2 } },
      { x: c.x, y: c.y + d + h / 2, anchor: 'middle', box: { x0: c.x - w / 2, y0: c.y + d, x1: c.x + w / 2, y1: c.y + d + h } },
      { x: c.x, y: c.y - d - h / 2, anchor: 'middle', box: { x0: c.x - w / 2, y0: c.y - d - h, x1: c.x + w / 2, y1: c.y - d } },
    ]
    const fits = (o: LabelSpot) =>
      o.box.x0 >= 4 &&
      o.box.x1 <= W - 4 &&
      o.box.y0 >= 4 &&
      o.box.y1 <= H - 4 &&
      !circles.some((other) => other !== c && hitsCircle(o.box, other)) &&
      !taken.some((t) => overlaps(o.box, t))
    const label = options.find(fits) ?? right
    taken.push(label.box)
    return { ...c, label }
  })
}

/**
 * Homepage map section (PR 3): a still picture of the country with a circle per
 * live city, drawn the way /map draws its clusters, so the page it links to
 * looks familiar. Server-rendered SVG, no map library and no motion.
 * [Decision — tester feedback, 2026-10-14: "Would have loved to know earlier
 * there was a map."]
 */
export function HomeMapBand({ cities }: Props) {
  const live = cities.filter((c) => c.isActive && c.count > 0).sort((a, b) => b.count - a.count)
  if (live.length === 0) return null
  const soon = cities.filter((c) => !c.isActive).sort((a, b) => a.name.localeCompare(b.name))
  const liveDots = place(live)
  const soonDots = place(soon)
  const liveTotal = live.reduce((sum, c) => sum + c.count, 0)
  const labeled = placeLabels(
    liveDots.map((c) => ({ ...c, r: dotRadius(c.count) })),
    soonDots.map((c) => ({ x: c.x, y: c.y, r: SOON_RADIUS }))
  )

  const summary =
    `Map of the United States. ${live.length} cities with businesses listed: ` +
    live.map((c) => `${c.name}, ${c.count}`).join('; ') +
    (soon.length > 0 ? `. Coming soon: ${soon.map((c) => c.name).join(', ')}.` : '.')

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
            {liveTotal.toLocaleString()} businesses in {live.length} cities. Start from the whole
            country, then tap a city to see what is near you.
          </p>
          <Link
            href="/map"
            className="inline-flex items-center justify-center h-12 px-7 mt-6 rounded-full bg-brand-black hover:bg-charcoal text-white font-subhead text-sm font-bold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          >
            Open the map
            <span aria-hidden="true" className="ml-2">→</span>
          </Link>
        </div>

        <figure className="lg:col-span-8 -mx-5 md:mx-0">
          {/* The picture repeats the button's link for anyone who taps it, but
              stays out of the tab order and the reading order: the button and
              the summary below already carry both. */}
          <Link href="/map" tabIndex={-1} aria-hidden="true" className="block">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" focusable="false">
              <path d={US_LAND_PATH} fill={GROUND} />
              <path d={US_STATE_BORDERS_PATH} fill="none" stroke="#ffffff" strokeWidth={1.5} strokeLinejoin="round" />
              {soonDots.map((c) => (
                <circle
                  key={c.slug}
                  cx={c.x}
                  cy={c.y}
                  r={SOON_RADIUS}
                  fill={GROUND}
                  stroke={INK}
                  strokeWidth={3}
                  strokeDasharray="5 4"
                />
              ))}
              {labeled.map((c) => {
                const { r, label } = c
                return (
                  <g key={c.slug}>
                    <circle cx={c.x} cy={c.y} r={r} fill="#ffffff" stroke={INK} strokeWidth={3} />
                    <text
                      x={c.x}
                      y={c.y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={COUNT_SIZE}
                      fontWeight={700}
                      fill={INK}
                      className="font-subhead"
                    >
                      {c.count}
                    </text>
                    {/* Names only from md up. On a phone they would be about
                        9px; the list under the map names every city instead. */}
                    <text
                      x={label.x}
                      y={label.y}
                      textAnchor={label.anchor}
                      dominantBaseline="central"
                      fontSize={LABEL_SIZE}
                      fontWeight={600}
                      fill={INK}
                      stroke={GROUND}
                      strokeWidth={6}
                      paintOrder="stroke"
                      className="font-subhead hidden md:inline"
                    >
                      {c.name}
                    </text>
                  </g>
                )
              })}
            </svg>
          </Link>
          <figcaption className="px-5 md:px-0 mt-4 flex flex-col gap-2">
            <span className="sr-only">{summary}</span>
            <div aria-hidden="true" className="md:hidden font-subhead text-sm text-charcoal">
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {live.map((c) => (
                  <li key={c.slug}>
                    {c.name} <span className="font-bold text-brand-black">{c.count}</span>
                  </li>
                ))}
              </ul>
              {soon.length > 0 && <p className="mt-1">Coming soon: {soon.map((c) => c.name).join(', ')}</p>}
            </div>
            <ul aria-hidden="true" className="flex flex-wrap gap-x-5 gap-y-1 font-subhead text-sm text-charcoal">
              <li className="inline-flex items-center gap-2">
                <svg viewBox="0 0 16 16" className="size-4" focusable="false">
                  <circle cx="8" cy="8" r="6.5" fill="#ffffff" stroke={INK} strokeWidth={1.5} />
                </svg>
                Live, with the number of businesses
              </li>
              {soonDots.length > 0 && (
                <li className="inline-flex items-center gap-2">
                  <svg viewBox="0 0 16 16" className="size-4" focusable="false">
                    <circle cx="8" cy="8" r="5" fill={GROUND} stroke={INK} strokeWidth={1.5} strokeDasharray="2.5 2" />
                  </svg>
                  Coming soon
                </li>
              )}
            </ul>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
