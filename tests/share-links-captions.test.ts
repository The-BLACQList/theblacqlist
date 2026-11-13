// =============================================================================
// Share links and captions
// =============================================================================
// The share sheet hands these strings to other companies' compose screens, so
// what they contain is what a follower sees. Pinned here:
//   * every intent URL encodes the caption and the link, and the link carries
//     UTM tags for its own platform;
//   * withUtm replaces existing utm_* instead of doubling them;
//   * no caption ever carries an amount or the sharer's name, and only the
//     verified stage says "Verified".
// =============================================================================

import { describe, expect, it } from 'vitest'

import { profileCaption, supportCaption } from '@/lib/share/captions'
import { cleanShareUrl, intentUrl, withUtm } from '@/lib/share/links'
import { shareFileName } from '@/lib/share/nativeShare'

const PAGE = 'https://theblacqlist.com/atlanta/business/mamas-kitchen'

describe('withUtm', () => {
  it('tags source, medium and campaign', () => {
    const u = new URL(withUtm(PAGE, 'instagram_story', 'profile_share'))
    expect(u.searchParams.get('utm_source')).toBe('instagram')
    expect(u.searchParams.get('utm_medium')).toBe('social')
    expect(u.searchParams.get('utm_campaign')).toBe('profile_share')
  })

  it('replaces existing utm tags rather than doubling them', () => {
    const tagged = withUtm(PAGE, 'x', 'profile_share')
    const retagged = new URL(withUtm(tagged, 'facebook', 'support_share'))
    expect(retagged.searchParams.getAll('utm_source')).toEqual(['facebook'])
    expect(retagged.searchParams.getAll('utm_campaign')).toEqual(['support_share'])
  })
})

describe('cleanShareUrl', () => {
  it('drops the query and hash', () => {
    expect(cleanShareUrl(`${PAGE}?tab=menu&utm_source=x#reviews`)).toBe(PAGE)
  })
})

describe('intentUrl', () => {
  const text = "Look what I found on The BLACQList 👀 Mama's Kitchen & Co."
  const url = withUtm(PAGE, 'x', 'profile_share')

  it('Facebook takes only the link', () => {
    const u = new URL(intentUrl('facebook', { text, url }))
    expect(u.hostname).toBe('www.facebook.com')
    expect(u.searchParams.get('u')).toBe(url)
  })

  it('X takes text and link as separate fields', () => {
    const u = new URL(intentUrl('x', { text, url }))
    expect(u.hostname).toBe('x.com')
    expect(u.searchParams.get('text')).toBe(text)
    expect(u.searchParams.get('url')).toBe(url)
  })

  it('Threads and WhatsApp put the link inside the text', () => {
    for (const platform of ['threads', 'whatsapp'] as const) {
      const u = new URL(intentUrl(platform, { text, url }))
      expect(u.searchParams.get('text')).toBe(`${text} ${url}`)
    }
  })

  it('email carries a subject and the link in the body', () => {
    const href = intentUrl('email', { text, url, subject: "Mama's Kitchen on The BLACQList" })
    expect(href.startsWith('mailto:?')).toBe(true)
    const params = new URLSearchParams(href.slice('mailto:?'.length))
    expect(params.get('subject')).toBe("Mama's Kitchen on The BLACQList")
    expect(params.get('body')).toBe(`${text}\n\n${url}`)
  })

  it('sms uses the form iOS and Android both accept', () => {
    const href = intentUrl('sms', { text, url })
    expect(href.startsWith('sms:?&body=')).toBe(true)
    expect(decodeURIComponent(href.slice('sms:?&body='.length))).toBe(`${text} ${url}`)
  })

  it('an ampersand in the caption cannot break out into a new parameter', () => {
    const u = new URL(intentUrl('x', { text: 'A & B&url=https://evil.example', url }))
    expect(u.searchParams.getAll('url')).toEqual([url])
  })
})

describe('profileCaption', () => {
  it('names the business, category and city', () => {
    expect(
      profileCaption({
        businessName: "Mama's Kitchen",
        categoryName: 'Restaurant',
        cityName: 'Atlanta',
      })
    ).toBe("Look what I found on The BLACQList 👀 Mama's Kitchen, Restaurant in Atlanta.")
  })

  it('reads cleanly without a category or city', () => {
    expect(profileCaption({ businessName: "Mama's Kitchen" })).toBe(
      "Look what I found on The BLACQList 👀 Mama's Kitchen."
    )
    expect(profileCaption({ businessName: 'Rooted', cityName: 'Detroit' })).toBe(
      'Look what I found on The BLACQList 👀 Rooted, in Detroit.'
    )
  })
})

describe('supportCaption', () => {
  it('celebrates without an amount', () => {
    const caption = supportCaption({ businessName: "Mama's Kitchen", stage: 'supported' })
    expect(caption).toBe("I supported Mama's Kitchen 🖤 Adding to #TheCollective on @theblacqlist.")
    expect(caption).not.toMatch(/\$|\d+\.\d{2}/)
    expect(caption).not.toMatch(/verified/i)
  })

  it('adds the verified line only at the verified stage', () => {
    expect(supportCaption({ businessName: "Mama's Kitchen", stage: 'verified' })).toMatch(
      /Verified by The BLACQList\.$/
    )
  })
})

describe('shareFileName', () => {
  it('makes a safe, branded file name', () => {
    expect(shareFileName("Mama's Kitchen & Café", 'story')).toBe(
      'the-blacqlist-mama-s-kitchen-cafe-story.png'
    )
    expect(shareFileName('Crème Brûlée Bar', 'story')).toBe(
      'the-blacqlist-creme-brulee-bar-story.png'
    )
    expect(shareFileName('🖤', 'post')).toBe('the-blacqlist-share-post.png')
  })
})
