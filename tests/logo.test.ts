import { describe, expect, it, vi, beforeEach } from 'vitest'

// Ticket 185: the logo. Pinned here:
//   * only a file the owner uploaded into this listing's logo folder can be set;
//   * the live page shows a logo on a claimed page only (the map-pin rule);
//   * an older full address is kept, unoptimized when next/image may not fetch it;
//   * the action checks ownership, that the file exists, and deletes the
//     uploaded logo it replaces or removes, never one set some other way.

const LISTING_ID = '0b6f5c7e-1d2a-4c3b-9e8f-7a6b5c4d3e2f'
const OTHER_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'
const NAME = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d.png'
const PATH = `listings/${LISTING_ID}/logo/${NAME}`
const OLD = `listings/${LISTING_ID}/logo/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg`

const h = vi.hoisted(() => {
  const state = {
    user: { id: 'u1' } as { id: string } | null,
    listing: null as Record<string, unknown> | null,
    objects: [] as { name: string }[],
    updateError: null as unknown,
  }
  const updates: Record<string, unknown>[] = []
  const removed: string[][] = []

  function makeClient() {
    return {
      from() {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          maybeSingle: async () => ({ data: state.listing, error: null }),
          update: (row: Record<string, unknown>) => {
            updates.push(row)
            return { eq: async () => ({ error: state.updateError }) }
          },
        }
        return builder
      },
    }
  }

  const service = {
    storage: {
      from: () => ({
        list: async () => ({ data: state.objects, error: null }),
        remove: async (paths: string[]) => {
          removed.push(paths)
          return { error: null }
        },
      }),
    },
  }

  return {
    state,
    updates,
    removed,
    createClient: vi.fn(async () => makeClient()),
    createServiceClient: vi.fn(() => service),
    getOwnerSession: vi.fn(async () => (state.user ? { user: state.user } : null)),
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: h.createClient,
  createServiceClient: h.createServiceClient,
}))
vi.mock('@/lib/dashboard/guard', () => ({ getOwnerSession: h.getOwnerSession }))
vi.mock('@/lib/dashboard/revalidateEditors', () => ({ revalidateOwnerEditors: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/listings/url', () => ({ buildEntityUrl: () => '/l/x' }))

import { isUploadedLogoPath } from '@/lib/media/logo'
import { entityLogo } from '@/lib/listings/logo'
import { setLogoAction } from '@/lib/actions/dashboard/setLogo'

describe('isUploadedLogoPath', () => {
  it('accepts a file in this listing’s logo folder', () => {
    expect(isUploadedLogoPath(LISTING_ID, PATH)).toBe(true)
  })

  it('rejects another listing’s logo, the cover folder, odd names and types', () => {
    expect(isUploadedLogoPath(LISTING_ID, `listings/${OTHER_ID}/logo/${NAME}`)).toBe(false)
    expect(isUploadedLogoPath(LISTING_ID, `listings/${LISTING_ID}/cover/${NAME}`)).toBe(false)
    expect(isUploadedLogoPath(LISTING_ID, `listings/${LISTING_ID}/logo/../x.png`)).toBe(false)
    expect(isUploadedLogoPath(LISTING_ID, `listings/${LISTING_ID}/logo/${NAME}.svg`)).toBe(false)
    expect(isUploadedLogoPath('not-a-uuid', PATH)).toBe(false)
    expect(isUploadedLogoPath(LISTING_ID, null)).toBe(false)
  })
})

describe('entityLogo', () => {
  it('resolves a stored path on a claimed page', () => {
    const logo = entityLogo({ logo_path: PATH, trust_tier: 'claimed', name: 'Ada’s' })
    expect(logo?.src).toMatch(new RegExp(`/storage/v1/object/public/listing-media/${PATH}$`))
    expect(logo?.alt).toBe('Ada’s logo')
    expect(logo?.unoptimized).toBeUndefined()
  })

  it('hides the logo on an unclaimed page', () => {
    expect(entityLogo({ logo_path: PATH, trust_tier: 'unclaimed', name: 'x' })).toBeNull()
  })

  it('shows it on verified and certified pages', () => {
    expect(entityLogo({ logo_path: PATH, trust_tier: 'verified', name: 'x' })).not.toBeNull()
    expect(entityLogo({ logo_path: PATH, trust_tier: 'certified', name: 'x' })).not.toBeNull()
  })

  it('returns null with no logo', () => {
    expect(entityLogo({ logo_path: null, trust_tier: 'claimed', name: 'x' })).toBeNull()
    expect(entityLogo({ logo_path: ' ', trust_tier: 'claimed', name: 'x' })).toBeNull()
  })

  it('keeps an older full address, unoptimized off the allowed hosts', () => {
    const logo = entityLogo({
      logo_path: 'https://example.org/logo.png',
      trust_tier: 'claimed',
      name: 'x',
    })
    expect(logo).toEqual({ src: 'https://example.org/logo.png', alt: 'x logo', unoptimized: true })
  })
})

describe('setLogoAction', () => {
  beforeEach(() => {
    h.state.user = { id: 'u1' }
    h.state.listing = {
      id: LISTING_ID,
      slug: 'x',
      status: 'published',
      entity_type: 'business',
      logo_path: null,
      cities: { slug: 'atlanta' },
    }
    h.state.objects = [{ name: NAME }]
    h.state.updateError = null
    h.updates.length = 0
    h.removed.length = 0
  })

  it('needs a signed-in owner of the listing', async () => {
    h.state.user = null
    expect(await setLogoAction({ listingId: LISTING_ID, path: PATH })).toEqual({
      ok: false,
      error: 'Please sign in again.',
    })
    h.state.user = { id: 'u1' }
    h.state.listing = null
    const result = await setLogoAction({ listingId: LISTING_ID, path: PATH })
    expect(result.ok).toBe(false)
    expect(h.updates).toEqual([])
  })

  it('refuses a path outside the listing’s logo folder', async () => {
    const result = await setLogoAction({
      listingId: LISTING_ID,
      path: `listings/${OTHER_ID}/logo/${NAME}`,
    })
    expect(result.ok).toBe(false)
    expect(h.updates).toEqual([])
  })

  it('refuses a file that is not in storage', async () => {
    h.state.objects = []
    const result = await setLogoAction({ listingId: LISTING_ID, path: PATH })
    expect(result.ok).toBe(false)
    expect(h.updates).toEqual([])
  })

  it('sets the logo and deletes the uploaded one it replaces', async () => {
    h.state.listing = { ...h.state.listing, logo_path: OLD }
    expect(await setLogoAction({ listingId: LISTING_ID, path: PATH })).toEqual({ ok: true })
    expect(h.updates).toEqual([{ logo_path: PATH }])
    expect(h.removed).toEqual([[OLD]])
  })

  it('removal clears the column and deletes the uploaded file', async () => {
    h.state.listing = { ...h.state.listing, logo_path: OLD }
    expect(await setLogoAction({ listingId: LISTING_ID, path: null })).toEqual({ ok: true })
    expect(h.updates).toEqual([{ logo_path: null }])
    expect(h.removed).toEqual([[OLD]])
  })

  it('leaves a logo set some other way in storage', async () => {
    h.state.listing = { ...h.state.listing, logo_path: 'https://example.org/logo.png' }
    expect(await setLogoAction({ listingId: LISTING_ID, path: null })).toEqual({ ok: true })
    expect(h.removed).toEqual([])
  })

  it('reports a failed save', async () => {
    h.state.updateError = { message: 'x' }
    const result = await setLogoAction({ listingId: LISTING_ID, path: PATH })
    expect(result.ok).toBe(false)
    expect(h.removed).toEqual([])
  })
})
