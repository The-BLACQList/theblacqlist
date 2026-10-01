import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ONBOARDING_INTERESTS,
  parseInterests,
  readSavedInterests,
} from '@/lib/onboarding/interests'

const updateUser = vi.fn()
const profileUpdate = vi.fn()
const profileEq = vi.fn()

vi.mock('@/lib/supabase/server', () => {
  const user = { id: 'u1', user_metadata: {} }
  const client = {
    auth: {
      getUser: async () => ({ data: { user } }),
      updateUser: (arg: unknown) => updateUser(arg),
    },
    from: (table: string) => {
      if (table === 'cities') {
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: async () => ({ data: { id: 'city-uuid' } }),
        }
        return chain
      }
      return {
        update: (v: unknown) => {
          profileUpdate(v)
          return { eq: (...a: unknown[]) => profileEq(...a) }
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

import { setOnboardingRoleAction } from '@/lib/actions/account/setOnboardingRole'

function form(entries: [string, string][]) {
  const f = new FormData()
  for (const [k, v] of entries) f.append(k, v)
  return f
}

describe('interests allowlist', () => {
  it('accepts real slugs and de-duplicates', () => {
    expect(parseInterests(['food-dining', 'food-dining', 'technology'])).toEqual([
      'food-dining',
      'technology',
    ])
  })
  it('rejects the whole list when any slug is unknown', () => {
    expect(parseInterests(['food-dining', 'nope'])).toBeNull()
    expect(parseInterests('food-dining')).toBeNull()
  })
  it('reads saved metadata leniently and caps at 4', () => {
    const all = ONBOARDING_INTERESTS.map((i) => i.slug)
    expect(readSavedInterests([...all, 'junk'])).toHaveLength(4)
    expect(readSavedInterests(['junk', 5, 'technology'])).toEqual([
      { slug: 'technology', label: 'Technology' },
    ])
    expect(readSavedInterests(undefined)).toEqual([])
  })
})

describe('setOnboardingRoleAction saves', () => {
  beforeEach(() => {
    updateUser.mockClear()
    profileUpdate.mockClear()
    profileEq.mockClear()
  })

  it('saves city and interests on Get started', async () => {
    await setOnboardingRoleAction(
      null,
      form([['role', 'supporter'], ['city', 'atlanta'], ['interests', 'technology']])
    )
    expect(updateUser.mock.calls[0]?.[0].data.interests).toEqual(['technology'])
    expect(profileUpdate).toHaveBeenCalledWith({ city_id: 'city-uuid' })
    expect(profileEq).toHaveBeenCalledWith('id', 'u1')
  })

  it('skip saves the city but no interests', async () => {
    await setOnboardingRoleAction(null, form([['role', 'supporter'], ['city', 'atlanta']]))
    expect(updateUser.mock.calls[0]?.[0].data).not.toHaveProperty('interests')
    expect(profileUpdate).toHaveBeenCalledWith({ city_id: 'city-uuid' })
  })

  it('drops the interests but still completes when one slug is not allowed', async () => {
    const r = await setOnboardingRoleAction(
      null,
      form([['role', 'supporter'], ['interests', 'technology'], ['interests', 'bogus']])
    )
    expect(updateUser.mock.calls[0]?.[0].data).not.toHaveProperty('interests')
    expect(r).toEqual({ success: true, role: 'supporter' })
  })

  it('ignores a malformed city value', async () => {
    await setOnboardingRoleAction(null, form([['role', 'owner'], ['city', "x'; drop"]]))
    expect(profileUpdate).not.toHaveBeenCalled()
  })
})
