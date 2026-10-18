import { describe, it, expect, vi, beforeEach } from 'vitest'

// Ticket 133. The Links section used to save any link type with no plan check,
// so a Free business could add Instagram there and skip the Starter social
// gate. Social profiles added here now follow the Social section's rule, and
// creators get socials on every plan. Other link types are unchanged.

const LISTING_ID = '0b6f5c7e-1d2a-4c3b-9e8f-7a6b5c4d3e2f'

const h = vi.hoisted(() => {
  const state = {
    user: { id: 'u1' } as { id: string } | null,
    listing: null as Record<string, unknown> | null,
  }
  const inserts: Record<string, unknown>[] = []

  function makeClient() {
    return {
      from(table: string) {
        const builder = {
          select: () => builder,
          eq: () => builder,
          is: () => builder,
          order: () => builder,
          limit: () => builder,
          maybeSingle: async () => ({
            data: table === 'listings' ? state.listing : null,
            error: null,
          }),
          insert: async (row: Record<string, unknown>) => {
            inserts.push(row)
            return { error: null }
          },
        }
        return builder
      },
    }
  }

  return {
    state,
    inserts,
    createClient: vi.fn(async () => makeClient()),
    getOwnerSession: vi.fn(async () => (state.user ? { user: state.user } : null)),
  }
})

vi.mock('@/lib/supabase/server', () => ({ createClient: h.createClient }))
vi.mock('@/lib/dashboard/guard', () => ({ getOwnerSession: h.getOwnerSession }))
vi.mock('@/lib/dashboard/revalidateEditors', () => ({ revalidateOwnerEditors: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/listings/url', () => ({ buildEntityUrl: () => '/l/x' }))

import { addListingLinkAction } from '@/lib/actions/dashboard/addListingLink'

function form(linkType: string, url: string): FormData {
  const fd = new FormData()
  fd.set('listing_id', LISTING_ID)
  fd.set('link_type', linkType)
  fd.set('url', url)
  return fd
}

function setListing(entityType: string, tier: string | null) {
  h.state.listing = {
    id: LISTING_ID,
    slug: 'x',
    status: 'draft',
    entity_type: entityType,
    tier,
    cities: { slug: 'atlanta' },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  h.inserts.length = 0
  h.state.user = { id: 'u1' }
})

describe('addListingLinkAction plan rules', () => {
  it('saves Instagram, TikTok and YouTube on a Free creator page', async () => {
    setListing('creator', 'free')
    const cases: [string, string][] = [
      ['instagram', 'https://instagram.com/me'],
      ['tiktok', 'https://tiktok.com/@me'],
      ['youtube', 'https://youtube.com/@me'],
    ]
    for (const [type, url] of cases) {
      expect(await addListingLinkAction(null, form(type, url))).toEqual({ success: true })
    }
    expect(h.inserts.map((r) => r.link_type)).toEqual(['instagram', 'tiktok', 'youtube'])
  })

  it('refuses Instagram on a Free business page with the Starter message', async () => {
    setListing('business', 'free')
    const result = await addListingLinkAction(null, form('instagram', 'https://instagram.com/shop'))
    expect(result).toEqual({
      error: 'Social links are part of Starter. Upgrade to add them to your page.',
    })
    expect(h.inserts).toHaveLength(0)
  })

  it('treats a missing tier as Free', async () => {
    setListing('restaurant', null)
    const result = await addListingLinkAction(null, form('tiktok', 'https://tiktok.com/@shop'))
    expect(result).toHaveProperty('error')
    expect(h.inserts).toHaveLength(0)
  })

  it('still saves a non-social link on a Free business page', async () => {
    setListing('business', 'free')
    const result = await addListingLinkAction(null, form('menu', 'https://shop.example/menu'))
    expect(result).toEqual({ success: true })
    expect(h.inserts).toHaveLength(1)
  })

  it('saves socials on a Starter business page', async () => {
    setListing('business', 'starter')
    const result = await addListingLinkAction(null, form('instagram', 'https://instagram.com/shop'))
    expect(result).toEqual({ success: true })
  })
})
