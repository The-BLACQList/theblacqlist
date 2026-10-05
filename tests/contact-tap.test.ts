// Which listing-page links count as contact taps for the weekly Featured score
// (ticket 123). Only website, call and directions; the SQL counts the same.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const track = vi.fn()
vi.mock('@/lib/analytics/client', () => ({ track: (...a: unknown[]) => track(...a) }))

import { contactKind, trackContactTap } from '@/lib/analytics/contactTap'

describe('contactKind', () => {
  it.each([
    ['tel:4045550100', 'call'],
    ['https://maps.google.com/?q=1%20Main%20St', 'directions'],
    ['https://www.google.com/maps/place/x', 'directions'],
    ['https://maps.apple.com/?q=x', 'directions'],
    ['https://www.twistedsoulatl.com/', 'website'],
    ['http://example.com', 'website'],
    ['mailto:hi@example.com', null],
    ['#visit', null],
    ['/atlanta/business/x', null],
  ])('%s is %s', (href, kind) => {
    expect(contactKind(href)).toBe(kind)
  })
})

describe('trackContactTap', () => {
  beforeEach(() => track.mockClear())

  it('sends the event for its surface with the kind', () => {
    trackContactTap('L1', 'tel:1', 'hero')
    trackContactTap('L1', 'https://x.com', 'action_bar')
    trackContactTap('L1', 'https://maps.apple.com/?q=x', 'at_a_glance')
    expect(track.mock.calls.map((c) => c[0])).toEqual([
      { event_name: 'hero_cta_click', entity_type: 'listing', entity_id: 'L1', properties: { kind: 'call', source: 'hero' } },
      { event_name: 'action_bar_cta_click', entity_type: 'listing', entity_id: 'L1', properties: { kind: 'website', source: 'action_bar' } },
      { event_name: 'cta_click', entity_type: 'listing', entity_id: 'L1', properties: { kind: 'directions', source: 'at_a_glance' } },
    ])
  })

  it('sends nothing for email or in-page links', () => {
    trackContactTap('L1', 'mailto:a@b.c', 'hero')
    trackContactTap('L1', '#visit', 'hero')
    expect(track).not.toHaveBeenCalled()
  })
})
