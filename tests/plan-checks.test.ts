import { describe, it, expect } from 'vitest'
import {
  checkAttributeCount,
  checkDescription,
  checkFaqAdd,
  checkPhotoAdd,
  checkSocialLinks,
  checkVideo,
} from '@/lib/stripe/planChecks'

// Ticket 119. Each check gets the same three cases: allowed, blocked, and the
// grandfathered edit (content saved before the limit existed is kept, and an
// unrelated save never fails because of it).

const long = (n: number) => 'a'.repeat(n)

describe('checkDescription', () => {
  it('allows Free up to 300 characters', () => {
    expect(checkDescription('free', long(300), null)).toBeNull()
  })

  it('blocks Free past 300 characters', () => {
    expect(checkDescription('free', long(301), null)).toMatch(/up to 300 characters/)
  })

  it('treats a null tier as Free', () => {
    expect(checkDescription(null, long(301), null)).not.toBeNull()
  })

  it('has no limit on Starter', () => {
    expect(checkDescription('starter', long(5000), null)).toBeNull()
  })

  it('keeps an unchanged long description (grandfathered)', () => {
    const saved = long(800)
    expect(checkDescription('free', saved, saved)).toBeNull()
    expect(checkDescription('free', `  ${saved}  `, saved)).toBeNull()
  })

  it('blocks a change that is still too long', () => {
    expect(checkDescription('free', long(799), long(800))).not.toBeNull()
  })

  it('allows shortening a long description to fit', () => {
    expect(checkDescription('free', long(250), long(800))).toBeNull()
  })
})

describe('checkSocialLinks', () => {
  const link = 'https://instagram.com/example'

  it('allows Starter to add a link', () => {
    expect(checkSocialLinks('starter', { social_instagram: link }, null)).toBeNull()
  })

  it('blocks Free from adding a link', () => {
    expect(checkSocialLinks('free', { social_instagram: link }, null)).toMatch(/part of Starter/)
  })

  it('blocks Free from changing a saved link', () => {
    expect(
      checkSocialLinks(
        'free',
        { social_instagram: 'https://instagram.com/other' },
        { social_instagram: link }
      )
    ).not.toBeNull()
  })

  it('keeps an unchanged saved link on Free (grandfathered)', () => {
    expect(
      checkSocialLinks('free', { social_instagram: link }, { social_instagram: link })
    ).toBeNull()
  })

  it('always allows clearing a link', () => {
    expect(
      checkSocialLinks('free', { social_instagram: '' }, { social_instagram: link })
    ).toBeNull()
  })

  it('ignores fields the form did not send', () => {
    expect(checkSocialLinks('free', { social_facebook: undefined }, null)).toBeNull()
  })
})

describe('checkAttributeCount', () => {
  it('allows Free up to 3', () => {
    expect(checkAttributeCount('free', 3, 0)).toBeNull()
  })

  it('blocks Free going to 4', () => {
    expect(checkAttributeCount('free', 4, 3)).toMatch(/up to 3 details/)
  })

  it('allows Starter up to 10 and blocks 11', () => {
    expect(checkAttributeCount('starter', 10, 0)).toBeNull()
    expect(checkAttributeCount('starter', 11, 10)).not.toBeNull()
  })

  it('keeps a count already over the limit, and allows swaps or removals (grandfathered)', () => {
    expect(checkAttributeCount('free', 6, 6)).toBeNull()
    expect(checkAttributeCount('free', 5, 6)).toBeNull()
  })

  it('blocks adding past a grandfathered count', () => {
    expect(checkAttributeCount('free', 7, 6)).not.toBeNull()
  })

  it('has no limit on Growth', () => {
    expect(checkAttributeCount('growth', 40, 0)).toBeNull()
  })
})

describe('checkFaqAdd', () => {
  it('blocks Free from adding any', () => {
    expect(checkFaqAdd('free', 0)).toMatch(/part of Starter/)
  })

  it('allows Starter up to 5', () => {
    expect(checkFaqAdd('starter', 4)).toBeNull()
    expect(checkFaqAdd('starter', 5)).toMatch(/up to 5 common questions/)
  })

  it('still blocks adding when a Free listing already has some (grandfathered rows stay)', () => {
    expect(checkFaqAdd('free', 2)).not.toBeNull()
  })

  it('has no limit on Growth', () => {
    expect(checkFaqAdd('growth', 50)).toBeNull()
  })
})

describe('checkVideo', () => {
  const url = 'https://youtube.com/watch?v=abc'

  it('allows Starter to set a video', () => {
    expect(checkVideo('starter', url, null)).toBeNull()
  })

  it('blocks Free from setting a video', () => {
    expect(checkVideo('free', url, null)).toMatch(/part of Starter/)
  })

  it('keeps an unchanged saved video on Free (grandfathered)', () => {
    expect(checkVideo('free', url, url)).toBeNull()
  })

  it('blocks Free from swapping a saved video', () => {
    expect(checkVideo('free', 'https://vimeo.com/1', url)).not.toBeNull()
  })

  it('always allows removing a video', () => {
    expect(checkVideo('free', null, url)).toBeNull()
    expect(checkVideo('free', '', url)).toBeNull()
  })
})

describe('checkPhotoAdd', () => {
  it('allows the first Free photo and blocks the second', () => {
    expect(checkPhotoAdd('free', 0)).toBeNull()
    expect(checkPhotoAdd('free', 1)).toBe('Your plan includes 1 photo. Upgrade to add more.')
  })

  it('allows Starter up to 10', () => {
    expect(checkPhotoAdd('starter', 9)).toBeNull()
    expect(checkPhotoAdd('starter', 10)).toBe('Your plan includes 10 photos. Upgrade to add more.')
  })

  it('blocks adding when a Free listing already has more (grandfathered photos stay)', () => {
    expect(checkPhotoAdd('free', 4)).not.toBeNull()
  })
})
