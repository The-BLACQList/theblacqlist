// Ticket 230: /api/places/suggest and /api/places/nearest.

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  allowed: true,
  limitCalls: [] as Array<{ bucket: string; limit: number }>,
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  rpcData: [] as unknown,
  rpcError: null as unknown,
}))

vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: async (opts: { bucket: string; limit: number }) => {
    h.limitCalls.push(opts)
    return h.allowed
  },
  getClientIp: () => '203.0.113.1',
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      h.rpcCalls.push({ fn, args })
      return { data: h.rpcData, error: h.rpcError }
    },
  }),
}))

const { GET: suggest } = await import('@/app/api/places/suggest/route')
const { GET: nearest } = await import('@/app/api/places/nearest/route')

function req(path: string) {
  return new NextRequest(`http://localhost${path}`)
}

beforeEach(() => {
  h.allowed = true
  h.limitCalls = []
  h.rpcCalls = []
  h.rpcData = []
  h.rpcError = null
})

describe('GET /api/places/suggest', () => {
  it('rejects a query under 2 or over 60 characters', async () => {
    expect((await suggest(req('/api/places/suggest?q=a'))).status).toBe(400)
    expect((await suggest(req(`/api/places/suggest?q=${'a'.repeat(61)}`))).status).toBe(400)
    expect(h.rpcCalls).toHaveLength(0)
  })

  it('sends the normalized readings and answers geoid + label only', async () => {
    h.rpcData = [
      { geoid: '4835000', label: 'Houston, TX', name: 'Houston', state_code: 'TX' },
      { geoid: 'nope', label: 'Broken' },
    ]
    const res = await suggest(req('/api/places/suggest?q=Houston,%20T'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      data: { places: [{ geoid: '4835000', label: 'Houston, TX' }] },
    })
    expect(h.rpcCalls[0]).toEqual({
      fn: 'suggest_us_places',
      args: { p_name: 'houston', p_state: 'T', p_alt_name: '', p_alt_state: '', p_limit: 8 },
    })
    expect(h.limitCalls[0]).toMatchObject({ bucket: 'place_suggest', limit: 60 })
    expect(res.headers.get('Cache-Control')).toContain('s-maxage')
  })

  it('answers 429 when over the limit', async () => {
    h.allowed = false
    const res = await suggest(req('/api/places/suggest?q=deca'))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'Too many requests.', code: 'RATE_LIMITED' })
  })

  it('answers an empty, uncached list when the database errors', async () => {
    h.rpcError = { message: 'function does not exist' }
    const res = await suggest(req('/api/places/suggest?q=deca'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ data: { places: [] } })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })
})

describe('GET /api/places/nearest', () => {
  it('rejects missing, empty or out-of-range coordinates', async () => {
    expect((await nearest(req('/api/places/nearest?lat=33.7'))).status).toBe(400)
    expect((await nearest(req('/api/places/nearest?lat=&lng='))).status).toBe(400)
    expect((await nearest(req('/api/places/nearest?lat=91&lng=0'))).status).toBe(400)
    expect((await nearest(req('/api/places/nearest?lat=abc&lng=1'))).status).toBe(400)
    expect(h.rpcCalls).toHaveLength(0)
  })

  it('rounds to 2 decimals and answers the place, never cached', async () => {
    h.rpcData = [{ geoid: '1322052', label: 'Decatur, GA' }]
    const res = await nearest(req('/api/places/nearest?lat=33.774912&lng=-84.296123'))
    expect(await res.json()).toEqual({
      data: { place: { geoid: '1322052', label: 'Decatur, GA' } },
    })
    expect(h.rpcCalls[0]).toEqual({ fn: 'nearest_us_place', args: { p_lat: 33.77, p_lng: -84.3 } })
    expect(h.limitCalls[0]).toMatchObject({ bucket: 'place_nearest' })
    expect(res.headers.get('Cache-Control')).toBe('no-store')
  })

  it('answers null when nothing is near', async () => {
    const res = await nearest(req('/api/places/nearest?lat=0&lng=0'))
    expect(await res.json()).toEqual({ data: { place: null } })
  })
})
