// Puts a longitude and latitude onto the homepage's US outline (PR 3).
//
// The same conic equal-area projection that drew components/home/usOutline.ts:
// standard parallels 29.5 and 45.5, centered at 96W 38.7N. It is the d3
// geoAlbers formula written out, so the homepage needs no map library.

import { US_PROJECTION } from '@/components/home/usOutline'

const RAD = Math.PI / 180
const SIN0 = Math.sin(29.5 * RAD)
const N = (SIN0 + Math.sin(45.5 * RAD)) / 2
const C = 1 + SIN0 * (2 * N - SIN0)
const R0 = Math.sqrt(C) / N

function raw(lambda: number, phi: number): [number, number] {
  const r = Math.sqrt(C - 2 * N * Math.sin(phi)) / N
  return [r * Math.sin(lambda * N), R0 - r * Math.cos(lambda * N)]
}

const [CX, CY] = raw(-0.6 * RAD, 38.7 * RAD)

/** Screen x and y, in the outline's viewBox units, for a point in the lower 48. */
export function projectUS(lng: number, lat: number): [number, number] {
  const [x, y] = raw((lng + 96) * RAD, lat * RAD)
  const { scale, translate } = US_PROJECTION
  return [translate[0] + (x - CX) * scale, translate[1] - (y - CY) * scale]
}
