import { describe, it, expect, vi, beforeEach } from 'vitest'

// =============================================================================
// The marketplace allowance — the enforcement half of an entitlement that was
// declared and never applied.
//
// `productLimit()`, `isAtLimit()` and `canAccess(_, 'storefront')` have existed
// in `lib/stripe/features.ts` since the tiers were designed, and until this
// module their ONLY caller was `tests/feature-gating.test.ts`
// `[Measured — repo, 2026-08-27]`. Any owner on any tier could create unlimited
// marketplace rows. These tests cover the four things that would silently undo
// the fix if they regressed:
//
//   1. products and services draw on ONE counter (`TierLimits.products` is
//      documented as "products + services combined") — counting them
//      separately doubles every owner's real allowance
//   2. `archived` frees a slot, `draft` does not — a draft is a row the owner
//      still holds
//   3. a read failure fails CLOSED — the one direction a limit must never fail,
//      because failing open hands out unmetered slots on a database blip
//   4. "your plan has no storefront" and "your storefront is full" are
//      different refusals and must not collapse into one message
// =============================================================================

const h = vi.hoisted(() => ({ createServiceClient: vi.fn() }))

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: h.createServiceClient,
  createClient: vi.fn(),
}))

import { marketplaceAllowances, assertCanAddMarketplaceItem } from '@/lib/marketplace/entitlements'

type Result = { data: unknown[] | null; error: { message: string } | null }
type Call = { table: string; chain: [string, unknown[]][] }

const ok = (data: unknown[]): Result => ({ data, error: null })
const fail = (message: string): Result => ({ data: null, error: { message } })

/** N rows, all on the same listing. Only `listing_id` is read by the counter. */
const rows = (listingId: string, n: number) =>
  Array.from({ length: n }, () => ({ listing_id: listingId }))

/**
 * A recording fake, same shape as the one in `expiry-sweeps.test.ts`. Thenable
 * so `await supabase.from(t).select(...).in(...).not(...)` resolves.
 */
function makeFakeClient(results: Record<string, Result>) {
  const calls: Call[] = []

  function from(table: string) {
    const chain: [string, unknown[]][] = []
    calls.push({ table, chain })

    const builder: Record<string, unknown> = {
      then: (onFulfilled: (r: Result) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(results[table] ?? ok([])).then(onFulfilled, onRejected),
    }
    for (const method of ['select', 'in', 'not', 'eq', 'is']) {
      builder[method] = (...args: unknown[]) => {
        chain.push([method, args])
        return builder
      }
    }
    return builder
  }

  const argsOf = (table: string, method: string): unknown[] | undefined =>
    calls.find((c) => c.table === table)?.chain.find(([m]) => m === method)?.[1]

  return {
    client: { from } as never,
    tablesTouched: () => calls.map((c) => c.table),
    argsOf,
  }
}

function install(results: Record<string, Result>) {
  const fake = makeFakeClient(results)
  h.createServiceClient.mockReturnValue(fake.client)
  return fake
}

beforeEach(() => {
  h.createServiceClient.mockReset()
})

// ─────────────────────────────────────────────────────────────────────────────
describe('marketplaceAllowances', () => {
  it('counts products and services against one combined allowance', async () => {
    install({
      marketplace_products: ok(rows('L1', 3)),
      marketplace_services: ok(rows('L1', 2)),
    })

    const [allowance] = await marketplaceAllowances([{ id: 'L1', tier: 'growth' }])

    // 3 + 2, not 3 and 2 measured separately against 25 each.
    expect(allowance?.used).toBe(5)
    expect(allowance?.limit).toBe(25)
    expect(allowance?.canAddMore).toBe(true)
  })

  it('excludes archived rows from the count, on both tables', async () => {
    const fake = install({
      marketplace_products: ok(rows('L1', 1)),
      marketplace_services: ok([]),
    })

    await marketplaceAllowances([{ id: 'L1', tier: 'growth' }])

    // An archived row is a slot the owner gave back. A draft is not — it is
    // absent from this filter on purpose.
    expect(fake.argsOf('marketplace_products', 'not')).toEqual(['status', 'in', '(archived)'])
    expect(fake.argsOf('marketplace_services', 'not')).toEqual(['status', 'in', '(archived)'])
  })

  it('scopes both counts to the listings asked about', async () => {
    const fake = install({ marketplace_products: ok([]), marketplace_services: ok([]) })

    await marketplaceAllowances([
      { id: 'L1', tier: 'growth' },
      { id: 'L2', tier: 'growth' },
    ])

    expect(fake.argsOf('marketplace_products', 'in')).toEqual(['listing_id', ['L1', 'L2']])
    expect(fake.argsOf('marketplace_services', 'in')).toEqual(['listing_id', ['L1', 'L2']])
  })

  it('attributes rows to the right listing when an owner has several', async () => {
    install({
      marketplace_products: ok([...rows('L1', 2), ...rows('L2', 1)]),
      marketplace_services: ok(rows('L2', 4)),
    })

    const result = await marketplaceAllowances([
      { id: 'L1', tier: 'growth' },
      { id: 'L2', tier: 'growth' },
    ])

    expect(result.map((a) => [a.listingId, a.used])).toEqual([
      ['L1', 2],
      ['L2', 5],
    ])
  })

  it('reports a listing with no marketplace rows as empty, not missing', async () => {
    install({ marketplace_products: ok([]), marketplace_services: ok([]) })

    const [allowance] = await marketplaceAllowances([{ id: 'L1', tier: 'growth' }])

    expect(allowance?.used).toBe(0)
    expect(allowance?.canAddMore).toBe(true)
  })

  it('refuses a tier whose plan has no storefront at all', async () => {
    install({ marketplace_products: ok([]), marketplace_services: ok([]) })

    const result = await marketplaceAllowances([
      { id: 'L1', tier: 'free' },
      { id: 'L2', tier: 'starter' },
      { id: 'L3', tier: null },
    ])

    for (const allowance of result) {
      expect(allowance.tierIncludesStorefront).toBe(false)
      expect(allowance.canAddMore).toBe(false)
    }
  })

  it('treats a premium listing as unlimited rather than as limit 0', async () => {
    install({
      marketplace_products: ok(rows('L1', 400)),
      marketplace_services: ok([]),
    })

    const [allowance] = await marketplaceAllowances([{ id: 'L1', tier: 'premium' }])

    // `null` is unlimited, and a falsy check on it would read as "no room".
    expect(allowance?.limit).toBeNull()
    expect(allowance?.canAddMore).toBe(true)
  })

  it('stops a listing that has used every slot', async () => {
    install({
      marketplace_products: ok(rows('L1', 25)),
      marketplace_services: ok([]),
    })

    const [allowance] = await marketplaceAllowances([{ id: 'L1', tier: 'growth' }])

    expect(allowance?.used).toBe(25)
    expect(allowance?.canAddMore).toBe(false)
  })

  it('fails closed when the product count cannot be read', async () => {
    install({
      marketplace_products: fail('connection reset'),
      marketplace_services: ok([]),
    })

    const [allowance] = await marketplaceAllowances([{ id: 'L1', tier: 'growth' }])

    // Not zero. A blip that read as "no rows yet" would hand out unmetered slots.
    expect(allowance?.canAddMore).toBe(false)
    expect(allowance?.used).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('fails closed when the service count cannot be read', async () => {
    install({
      marketplace_products: ok([]),
      marketplace_services: fail('connection reset'),
    })

    const [allowance] = await marketplaceAllowances([{ id: 'L1', tier: 'growth' }])

    expect(allowance?.canAddMore).toBe(false)
  })

  it('queries nothing when there are no listings to count', async () => {
    const fake = install({})

    const result = await marketplaceAllowances([])

    expect(result).toEqual([])
    expect(fake.tablesTouched()).toEqual([])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('assertCanAddMarketplaceItem', () => {
  it('returns null — no refusal — when the listing has room', async () => {
    install({ marketplace_products: ok(rows('L1', 1)), marketplace_services: ok([]) })

    expect(await assertCanAddMarketplaceItem('L1', 'growth', 'product')).toBeNull()
  })

  it('tells a no-storefront tier it is not open yet — never to buy an unbuyable tier', async () => {
    install({ marketplace_products: ok([]), marketplace_services: ok([]) })

    const product = await assertCanAddMarketplaceItem('L1', 'free', 'product')
    const service = await assertCanAddMarketplaceItem('L1', 'free', 'service')

    expect(product?.error).toContain("isn't open yet")
    expect(product?.error).toContain('product')
    expect(service?.error).toContain('service')
    // Storefronts need Growth+, and Growth and Premium are deliberately not for
    // sale (decision D-M, 2026-09-01). Naming either one here sends the owner to
    // /pricing to buy something that renders disabled. This is the guard that
    // stops that copy coming back.
    expect(product?.error).not.toMatch(/upgrade|growth|premium/i)
    expect(service?.error).not.toMatch(/upgrade|growth|premium/i)
    // The refusal is attached to the listing selector, which is the control the
    // owner can actually act on.
    expect(product?.fieldErrors?.['listing_id']).toBeTruthy()
  })

  it('gives a full storefront a different message from an ineligible one', async () => {
    install({ marketplace_products: ok(rows('L1', 25)), marketplace_services: ok([]) })

    const refusal = await assertCanAddMarketplaceItem('L1', 'growth', 'product')

    expect(refusal?.error).toContain('25')
    // "You are full" must not read as "your plan cannot do this" — the actions
    // they lead to are different (archive one vs. wait for the marketplace).
    expect(refusal?.error).not.toMatch(/isn't open yet/i)
    expect(refusal?.error).toMatch(/archive/i)
    // A full page cannot buy its way to more room either — Premium is unbuyable.
    expect(refusal?.error).not.toMatch(/upgrade|growth|premium/i)
    expect(refusal?.fieldErrors?.['listing_id']).toBeTruthy()
  })

  it('refuses rather than allows when the count cannot be read', async () => {
    install({ marketplace_products: fail('timeout'), marketplace_services: ok([]) })

    expect(await assertCanAddMarketplaceItem('L1', 'growth', 'product')).not.toBeNull()
  })
})
