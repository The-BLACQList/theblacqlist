// =============================================================================
// lib/marketing/launch-attribution.ts (pre-launch R2, R3, R4, R5)
// =============================================================================
// The browser posts UTM values and a referrer; the server stores them with the
// service-role client. These helpers are the only thing between an arbitrary
// query string and a database column, so the rejection cases matter as much as
// the happy path.
// =============================================================================

import { describe, expect, it } from 'vitest'

import {
  EMPTY_ATTRIBUTION,
  PRE_LAUNCH_SHARE_URL,
  REDIRECT_PRESERVED_KEYS,
  SIGNUP_ROLES,
  appendAttribution,
  attributionFromFormData,
  attributionFromSearch,
  parseSignupRole,
  preservedRedirectSearch,
  readBrowserAttribution,
  referrerOrigin,
  sanitizeUtmValue,
} from '@/lib/marketing/launch-attribution'

describe('sanitizeUtmValue', () => {
  it('keeps plain campaign labels, trimmed', () => {
    expect(sanitizeUtmValue('instagram')).toBe('instagram')
    expect(sanitizeUtmValue('  story-1005 ')).toBe('story-1005')
    expect(sanitizeUtmValue('owner_headsup.email+v2')).toBe('owner_headsup.email+v2')
  })

  it('drops markup, quotes, slashes, URLs and control characters', () => {
    for (const bad of ['<script>', '"x"', "it's", 'a/b', 'https://evil.example', 'a\nb', 'a;b']) {
      expect(sanitizeUtmValue(bad), bad).toBeNull()
    }
  })

  it('drops empty, non-string and over-long values', () => {
    expect(sanitizeUtmValue('')).toBeNull()
    expect(sanitizeUtmValue('   ')).toBeNull()
    expect(sanitizeUtmValue(undefined)).toBeNull()
    expect(sanitizeUtmValue(42)).toBeNull()
    expect(sanitizeUtmValue('a'.repeat(100))).toBe('a'.repeat(100))
    expect(sanitizeUtmValue('a'.repeat(101))).toBeNull()
  })
})

describe('referrerOrigin', () => {
  it('keeps the origin only, never the path or query', () => {
    expect(referrerOrigin('https://l.instagram.com/?u=https%3A%2F%2Ftheblacqlist.com&e=token')).toBe(
      'https://l.instagram.com'
    )
    expect(referrerOrigin('http://localhost:3000/some/path')).toBe('http://localhost:3000')
  })

  it('rejects non-http schemes, junk and empty values', () => {
    expect(referrerOrigin('javascript:alert(1)')).toBeNull()
    expect(referrerOrigin('android-app://com.instagram.android')).toBeNull()
    expect(referrerOrigin('not a url')).toBeNull()
    expect(referrerOrigin('')).toBeNull()
    expect(referrerOrigin(null)).toBeNull()
  })
})

describe('attributionFromSearch (the browser side)', () => {
  it('captures the four UTM keys and the referrer origin', () => {
    expect(
      attributionFromSearch(
        '?utm_source=instagram&utm_medium=social&utm_campaign=pre-launch&utm_content=bio-link&utm_term=x',
        'https://l.instagram.com/redirect?u=abc'
      )
    ).toEqual({
      utm_source: 'instagram',
      utm_medium: 'social',
      utm_campaign: 'pre-launch',
      utm_content: 'bio-link',
      referrer: 'https://l.instagram.com',
    })
  })

  it('is all null for a direct visit', () => {
    expect(attributionFromSearch('', '')).toEqual(EMPTY_ATTRIBUTION)
  })
})

describe('attributionFromFormData (the server side never trusts the browser)', () => {
  it('re-validates every posted value', () => {
    const fd = new FormData()
    fd.set('utm_source', 'share')
    fd.set('utm_medium', '<img src=x>')
    fd.set('utm_campaign', 'pre-launch')
    fd.set('referrer', 'https://www.google.com/search?q=private+thing')
    expect(attributionFromFormData(fd)).toEqual({
      utm_source: 'share',
      utm_medium: null,
      utm_campaign: 'pre-launch',
      utm_content: null,
      referrer: 'https://www.google.com',
    })
  })

  it('round-trips what appendAttribution posts, and posts nothing for nulls', () => {
    const attribution = attributionFromSearch('?utm_source=share&utm_campaign=pre-launch', '')
    const fd = appendAttribution(new FormData(), attribution)
    expect([...fd.keys()].sort()).toEqual(['utm_campaign', 'utm_source'])
    expect(attributionFromFormData(fd)).toEqual(attribution)
  })
})

describe('parseSignupRole (R3, optional)', () => {
  it('accepts the two roles', () => {
    expect(parseSignupRole('owner')).toBe('owner')
    expect(parseSignupRole('supporter')).toBe('supporter')
  })

  it('treats anything else, including no answer, as null', () => {
    for (const raw of [undefined, null, '', 'admin', 'Owner', ' owner']) {
      expect(parseSignupRole(raw), String(raw)).toBeNull()
    }
  })

  it('has exactly the two roles the migration CHECK allows', () => {
    expect([...SIGNUP_ROLES]).toEqual(['owner', 'supporter'])
  })
})

describe('preservedRedirectSearch (R5)', () => {
  it('keeps the UTM keys, including utm_term, and nothing else', () => {
    const params = new URLSearchParams(
      'utm_source=ig&preview=wrong&utm_medium=social&code=abc&utm_campaign=pre-launch&utm_content=c&utm_term=t&fbclid=x'
    )
    const kept = new URLSearchParams(preservedRedirectSearch(params))
    expect([...kept.keys()].sort()).toEqual([...REDIRECT_PRESERVED_KEYS].sort())
    expect(kept.get('utm_source')).toBe('ig')
  })

  it('returns an empty string when there is nothing to keep', () => {
    expect(preservedRedirectSearch(new URLSearchParams('preview=x&code=y'))).toBe('')
    expect(preservedRedirectSearch(new URLSearchParams('utm_source='))).toBe('')
  })
})

describe('the share link (R4)', () => {
  it('carries utm_source=share and utm_campaign=pre-launch to the home page', () => {
    const url = new URL(PRE_LAUNCH_SHARE_URL)
    expect(url.origin + url.pathname).toBe('https://theblacqlist.com/')
    expect(url.searchParams.get('utm_source')).toBe('share')
    expect(url.searchParams.get('utm_campaign')).toBe('pre-launch')
  })

  it('survives the coming-soon redirect with its UTMs intact', () => {
    const url = new URL(PRE_LAUNCH_SHARE_URL)
    expect(preservedRedirectSearch(url.searchParams)).toBe(url.search)
  })
})

describe('readBrowserAttribution', () => {
  it('is empty on the server', () => {
    expect(readBrowserAttribution()).toEqual(EMPTY_ATTRIBUTION)
  })
})
