// Ticket 230: onboarding saves the US place someone picked.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  place: null as null | { geoid: string; name: string; state_code: string },
  activeCity: null as null | { id: string },
  profileUpdate: vi.fn(),
  cityFilters: [] as Array<[string, string, unknown]>,
}))

vi.mock('@/lib/supabase/server', () => {
  const user = { id: 'u1', user_metadata: {} }
  const client = {
    auth: {
      getUser: async () => ({ data: { user } }),
      updateUser: async () => ({}),
    },
    from: (table: string) => {
      if (table === 'us_places') {
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: async () => ({ data: h.place }),
        }
        return chain
      }
      if (table === 'cities') {
        const chain = {
          select: () => chain,
          eq: (k: string, v: unknown) => (h.cityFilters.push(['eq', k, v]), chain),
          ilike: (k: string, v: unknown) => (h.cityFilters.push(['ilike', k, v]), chain),
          limit: () => chain,
          maybeSingle: async () => ({ data: h.activeCity }),
        }
        return chain
      }
      return {
        update: (v: unknown) => {
          h.profileUpdate(v)
          return { eq: async () => ({}) }
        },
      }
    },
  }
  const service = {
    from: () => ({
      select: () => ({
        eq: () => ({ in: () => ({ maybeSingle: async () => ({ data: { role: 'supporter' } }) }) }),
      }),
    }),
  }
  return { createClient: async () => client, createServiceClient: () => service }
})

const { setOnboardingRoleAction } = await import('@/lib/actions/account/setOnboardingRole')

function form(entries: [string, string][]) {
  const f = new FormData()
  for (const [k, v] of entries) f.append(k, v)
  return f
}

beforeEach(() => {
  h.place = null
  h.activeCity = null
  h.profileUpdate.mockClear()
  h.cityFilters = []
})

describe('setOnboardingRoleAction home place', () => {
  it('saves the place, and the city when it is one of ours', async () => {
    h.place = { geoid: '1304000', name: 'Atlanta', state_code: 'GA' }
    h.activeCity = { id: 'city-uuid' }
    const r = await setOnboardingRoleAction(
      null,
      form([
        ['role', 'supporter'],
        ['place', '1304000'],
      ])
    )
    expect(h.profileUpdate).toHaveBeenCalledWith({
      home_place_geoid: '1304000',
      city_id: 'city-uuid',
    })
    expect(h.cityFilters).toContainEqual(['ilike', 'name', 'Atlanta'])
    expect(h.cityFilters).toContainEqual(['eq', 'states.code', 'GA'])
    expect(r).toEqual({ success: true, role: 'supporter' })
  })

  it('saves only the place for a town that is not one of our cities', async () => {
    h.place = { geoid: '2849320', name: 'Mound Bayou', state_code: 'MS' }
    await setOnboardingRoleAction(
      null,
      form([
        ['role', 'owner'],
        ['place', '2849320'],
      ])
    )
    expect(h.profileUpdate).toHaveBeenCalledWith({ home_place_geoid: '2849320' })
  })

  it('writes nothing for an unknown or malformed place', async () => {
    await setOnboardingRoleAction(
      null,
      form([
        ['role', 'supporter'],
        ['place', '9999999'],
      ])
    )
    await setOnboardingRoleAction(
      null,
      form([
        ['role', 'supporter'],
        ['place', "1'; drop"],
      ])
    )
    expect(h.profileUpdate).not.toHaveBeenCalled()
  })

  it('still completes onboarding when nothing is picked', async () => {
    const r = await setOnboardingRoleAction(null, form([['role', 'supporter']]))
    expect(h.profileUpdate).not.toHaveBeenCalled()
    expect(r).toEqual({ success: true, role: 'supporter' })
  })
})
