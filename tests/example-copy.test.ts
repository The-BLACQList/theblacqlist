// Ticket 184 — which links may work on a sample page. ExampleLinkGuard holds
// every other link so a visitor cannot leave through a business that does not
// exist; the banner's variant switcher and in-page anchors must keep working.

import { describe, expect, it } from 'vitest'

import { EXAMPLE_BANNER_TEXT, EXAMPLE_LINK_NOTE, isAllowedExampleHref } from '@/lib/example/copy'

describe('isAllowedExampleHref', () => {
  it('allows in-page anchors and the sample pages themselves', () => {
    for (const href of [
      '#reviews',
      '#',
      '/example',
      '/example/storefront',
      '/example/professional',
      '/example/creative',
      '/example?x=1',
      '/example#top',
    ]) {
      expect(isAllowedExampleHref(href), href).toBe(true)
    }
  })

  it('holds everything that would leave the sample page', () => {
    for (const href of [
      '/',
      '/discover',
      '/sign-in',
      '/atlanta-ga/restaurant/test-business-123',
      '/examples',
      '/example-page',
      'https://example.com',
      'https://example.com/example/storefront',
      'tel:+14045550123',
      'mailto:hello@example.com',
      'javascript:void(0)',
      '',
    ]) {
      expect(isAllowedExampleHref(href), href).toBe(false)
    }
  })
})

describe('copy', () => {
  it('names the business and says the figures are illustrative', () => {
    expect(EXAMPLE_BANNER_TEXT).toContain('Test Business 123')
    expect(EXAMPLE_BANNER_TEXT).toMatch(/not a real business/)
    expect(EXAMPLE_LINK_NOTE.length).toBeGreaterThan(0)
  })
})
