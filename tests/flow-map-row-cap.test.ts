// Ticket 278: runs the real /flow-map page against a stand-in API that returns
// at most 1,000 rows, so the map can't quietly lose businesses past the cap.

import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const CAP = 1000
const uuid = (prefix: string, n: number) =>
  `${prefix}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`

const state = { businesses: 0, receipts: 0, failLaterPage: null as string | null }

function rowsFor(table: string): { id: string }[] {
  if (table === 'listings') {
    return Array.from({ length: state.businesses }, (_, i) => ({
      id: uuid('a', i + 1),
      name: `Sample ${i + 1}`,
      slug: `sample-${i + 1}`,
      entity_type: 'business',
      primary_level: 'local',
      category_id: null,
      cities: { slug: 'sample-city' },
    }))
  }
  if (table === 'spend_events') {
    return Array.from({ length: state.receipts }, (_, i) => ({
      id: uuid('b', i + 1),
      amount_cents: 2500,
      listing_id: uuid('a', 1),
      created_at: '2026-11-24T00:00:00Z',
    }))
  }
  return []
}

function query(table: string) {
  let rows = rowsFor(table)
  let after = ''
  let limit = CAP
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is', 'not', 'gte', 'order']) chain[m] = () => chain
  chain.gt = (_c: string, v: string) => {
    after = v
    rows = rows.filter((r) => r.id > v)
    return chain
  }
  chain.in = (_c: string, ids: string[]) => {
    rows = rows.filter((r) => ids.includes(r.id))
    return chain
  }
  chain.limit = (n: number) => {
    limit = n
    return chain
  }
  chain.then = (resolve: (v: unknown) => unknown) => {
    const laterPage = after !== '' && !after.startsWith('00000000')
    if (laterPage && state.failLaterPage === table) {
      return resolve({ data: null, error: { message: 'boom' }, count: null })
    }
    return resolve({ data: rows.slice(0, Math.min(CAP, limit)), error: null, count: rows.length })
  }
  return chain
}

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: query }),
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }),
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('@/components/flow-map/silo/SiloExperience', () => {
  const SiloExperience = () => null
  return { SiloExperience, default: SiloExperience }
})

import FlowMapPage from '@/app/(public)/flow-map/page'

interface MapProps {
  businesses: { id: string }[]
  totalSpentCents: number | null
  receiptCount: number | null
  ticker: unknown[]
  headline: string
}

/** The map's props, or null when the page shows its load-failed state instead. */
function findMap(node: ReactNode): MapProps | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findMap(child)
      if (hit) return hit
    }
    return null
  }
  if (!isValidElement(node)) return null
  const { props } = node as ReactElement<Partial<MapProps> & { children?: ReactNode }>
  if (props.businesses) return props as MapProps
  return findMap(props.children)
}

/** Every text node written directly in the page. */
function textOf(node: ReactNode): string {
  if (typeof node === 'string') return node
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (!isValidElement(node)) return ''
  return textOf((node as ReactElement<{ children?: ReactNode }>).props.children)
}

const renderPage = async () => FlowMapPage({ searchParams: Promise.resolve({}) })

beforeEach(() => {
  state.businesses = 0
  state.receipts = 0
  state.failLaterPage = null
})

describe('/flow-map past the row cap', () => {
  it.each([706, 1500, 2345])('shows all %i published businesses', async (n) => {
    state.businesses = n
    const map = findMap(await renderPage())
    expect(new Set(map!.businesses.map((b) => b.id)).size).toBe(n)
  })

  it('adds up every receipt', async () => {
    state.businesses = 3
    state.receipts = 2345
    const map = findMap(await renderPage())!
    expect(map.receiptCount).toBe(2345)
    expect(map.totalSpentCents).toBe(2345 * 2500)
  })

  // Ticket 286. Held figures and rows must not reach the browser at all.
  it.each([0, 1, 4])('holds the totals and the Latest list at %i receipts', async (n) => {
    state.businesses = 3
    state.receipts = n
    const map = findMap(await renderPage())!
    expect(map.totalSpentCents).toBeNull()
    expect(map.receiptCount).toBeNull()
    expect(map.ticker).toEqual([])
    expect(map.headline).toBe('Where Does Our Money Go?')
  })

  it('publishes them at 5 receipts', async () => {
    state.businesses = 3
    state.receipts = 5
    const map = findMap(await renderPage())!
    expect(map.totalSpentCents).toBe(5 * 2500)
    expect(map.receiptCount).toBe(5)
    expect(map.headline).toBe('$125 spent with businesses on the list')
  })

  it.each(['listings', 'spend_events'])(
    'shows the load-failed state, never part of the map, when a later page of %s fails',
    async (table) => {
      state.businesses = 1500
      state.receipts = 1500
      state.failLaterPage = table
      const page = await renderPage()
      expect(findMap(page)).toBeNull()
      expect(textOf(page)).toContain("We couldn't load The Collective.")
    }
  )
})
