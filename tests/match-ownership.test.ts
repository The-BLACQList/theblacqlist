import { describe, expect, it } from 'vitest'

import { matchOwnership } from '@/lib/listings/matchOwnership'

describe('matchOwnership', () => {
  it('is open with no owner and unclaimed', () => {
    expect(matchOwnership({ owner_user_id: null, trust_tier: 'unclaimed' }, 'u1')).toBe('open')
  })
  it('is yours when the caller owns it, whatever the tier', () => {
    expect(matchOwnership({ owner_user_id: 'u1', trust_tier: 'claimed' }, 'u1')).toBe('yours')
    expect(matchOwnership({ owner_user_id: 'u1', trust_tier: 'verified' }, 'u1')).toBe('yours')
  })
  it('is managed when someone else owns it', () => {
    expect(matchOwnership({ owner_user_id: 'u2', trust_tier: 'claimed' }, 'u1')).toBe('managed')
  })
  it('is managed when ownerless but not unclaimed', () => {
    expect(matchOwnership({ owner_user_id: null, trust_tier: 'claimed' }, 'u1')).toBe('managed')
  })
})
