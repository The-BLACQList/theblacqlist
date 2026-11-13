// =============================================================================
// Messages about job and event postings (owner-experience round 2, part H,
// 2026-11-13): whether a posting takes messages, and the owner's quick replies.
// =============================================================================

import { describe, expect, it } from 'vitest'

import {
  formatEventWhen,
  formatEventWhere,
  messageButtonLabel,
  postingFollowsPage,
  postingInboxOpen,
  postingKind,
  postingTag,
  type PostingInboxInput,
} from '@/lib/messaging/postings'
import { buildQuickReplies, insertReply, savedRepliesFor, summarizeHours } from '@/lib/messaging/quickReplies'
import { MESSAGE_MAX_LENGTH } from '@/lib/messaging/constants'
import type { WeeklyHours } from '@/types'

const OWNER = '22222222-2222-4222-8222-222222222222'
const SOMEONE_ELSE = '33333333-3333-4333-8333-333333333333'
const PAGE = '11111111-1111-4111-8111-111111111111'
const NOW = new Date('2026-11-13T17:00:00Z')

function posting(overrides: Partial<PostingInboxInput> = {}): PostingInboxInput {
  return {
    kind: 'job',
    ownerUserId: OWNER,
    ownMessagingEnabled: false,
    linkedPage: null,
    closesAt: null,
    startsAt: null,
    endsAt: null,
    ...overrides,
  }
}

describe('postingKind', () => {
  it('knows jobs and events, and nothing else', () => {
    expect(postingKind('job')).toBe('job')
    expect(postingKind('event')).toBe('event')
    expect(postingKind('business')).toBeNull()
    expect(postingKind(null)).toBeNull()
  })
})

describe('postingInboxOpen', () => {
  it('follows the linked page when the same owner has it', () => {
    const linked = (messagingEnabled: boolean) => ({ id: PAGE, ownerUserId: OWNER, messagingEnabled })
    expect(postingInboxOpen(posting({ linkedPage: linked(true), ownMessagingEnabled: false }), NOW)).toBe(true)
    expect(postingInboxOpen(posting({ linkedPage: linked(false), ownMessagingEnabled: true }), NOW)).toBe(false)
  })

  it('uses its own switch when unlinked', () => {
    expect(postingInboxOpen(posting({ ownMessagingEnabled: true }), NOW)).toBe(true)
    expect(postingInboxOpen(posting({ ownMessagingEnabled: false }), NOW)).toBe(false)
  })

  it("ignores a link to someone else's page", () => {
    const linkedPage = { id: PAGE, ownerUserId: SOMEONE_ELSE, messagingEnabled: true }
    expect(postingFollowsPage({ ownerUserId: OWNER, linkedPage })).toBe(false)
    expect(postingInboxOpen(posting({ linkedPage, ownMessagingEnabled: false }), NOW)).toBe(false)
  })

  it('never follows a page when the posting has no owner', () => {
    const linkedPage = { id: PAGE, ownerUserId: null, messagingEnabled: true }
    expect(postingFollowsPage({ ownerUserId: null, linkedPage })).toBe(false)
  })

  it('closes once the role closes', () => {
    const open = posting({ ownMessagingEnabled: true })
    expect(postingInboxOpen({ ...open, closesAt: '2026-11-12T00:00:00Z' }, NOW)).toBe(false)
    expect(postingInboxOpen({ ...open, closesAt: '2026-11-20T00:00:00Z' }, NOW)).toBe(true)
  })

  it('closes once the event is over (end time, else 24 hours after the start)', () => {
    const open = posting({ kind: 'event', ownMessagingEnabled: true })
    expect(postingInboxOpen({ ...open, startsAt: '2026-11-10T18:00:00Z', endsAt: '2026-11-10T22:00:00Z' }, NOW)).toBe(
      false
    )
    expect(postingInboxOpen({ ...open, startsAt: '2026-11-13T01:00:00Z' }, NOW)).toBe(true)
    expect(postingInboxOpen({ ...open, startsAt: '2026-11-11T01:00:00Z' }, NOW)).toBe(false)
    expect(postingInboxOpen({ ...open, startsAt: '2026-11-20T18:00:00Z' }, NOW)).toBe(true)
  })
})

describe('messageButtonLabel / postingTag', () => {
  it('names the button for what is being asked about', () => {
    expect(messageButtonLabel('compose', 'job')).toBe('Ask about this role')
    expect(messageButtonLabel('sign_in', 'event')).toBe('Ask about this event')
    expect(messageButtonLabel('compose', null)).toBe('Message')
    expect(messageButtonLabel('thread', 'job')).toBe('View messages')
  })

  it('tags inbox rows', () => {
    expect(postingTag('job', 'Line cook')).toBe('Job · Line cook')
    expect(postingTag('event', 'Spring market')).toBe('Event · Spring market')
  })
})

describe('formatEventWhen / formatEventWhere', () => {
  it("formats in the event's zone, falling back to Eastern", () => {
    expect(formatEventWhen('2026-03-07T23:00:00Z', 'America/New_York')).toBe('Saturday, March 7 at 6:00 PM')
    expect(formatEventWhen('2026-03-07T23:00:00Z', 'America/Los_Angeles')).toBe('Saturday, March 7 at 3:00 PM')
    expect(formatEventWhen('2026-03-07T23:00:00Z', 'Not/AZone')).toBe('Saturday, March 7 at 6:00 PM')
    expect(formatEventWhen('nope', null)).toBeNull()
    expect(formatEventWhen(null)).toBeNull()
  })

  it('says online, or the venue and city', () => {
    expect(formatEventWhere({ isOnline: true, venueName: 'Hall', cityText: 'Detroit' })).toBe('Online')
    expect(formatEventWhere({ isOnline: false, venueName: ' Hall ', cityText: 'Detroit, MI' })).toBe(
      'Hall, Detroit, MI'
    )
    expect(formatEventWhere({ isOnline: false, venueName: null, cityText: null })).toBeNull()
  })
})

describe('buildQuickReplies', () => {
  const ids = (r: { id: string }[]) => r.map((x) => x.id)

  it('fills job replies from the posting', () => {
    const replies = buildQuickReplies(
      {
        kind: 'job',
        title: 'Line cook',
        applyUrl: 'https://example.com/apply',
        applyEmail: 'jobs@example.com',
        closesAt: '2026-12-01T17:00:00Z',
      },
      NOW
    )
    expect(ids(replies)).toEqual(['job-apply', 'job-resume', 'job-in-touch', 'job-filled'])
    expect(replies[0]?.text).toContain('https://example.com/apply')
    expect(replies[1]?.text).toContain('jobs@example.com')
    expect(replies[2]?.text).toContain('until December 1, 2026')
  })

  it('leaves out job replies with nothing to say, and drops a past closing date', () => {
    const replies = buildQuickReplies(
      { kind: 'job', title: 'Line cook', applyUrl: null, applyEmail: null, closesAt: '2026-11-01T00:00:00Z' },
      NOW
    )
    expect(ids(replies)).toEqual(['job-in-touch', 'job-filled'])
    expect(replies[0]?.text).toContain('will be in touch soon')
  })

  it('fills event replies, with the venue or online', () => {
    const base = {
      kind: 'event' as const,
      title: 'Spring market',
      startsAt: '2026-03-07T23:00:00Z',
      timezone: 'America/New_York',
      venueName: 'Eastern Market',
      isOnline: false,
      ticketUrl: 'https://tix.example.com',
      pageUrl: 'https://theblacqlist.com/detroit/event/spring-market',
    }
    const replies = buildQuickReplies(base, NOW)
    expect(ids(replies)).toEqual(['event-tickets', 'event-still-on', 'event-sold-out', 'event-details'])
    expect(replies[1]?.text).toBe('Yes, Spring market is still on: Saturday, March 7 at 6:00 PM at Eastern Market. See you there!')
    expect(buildQuickReplies({ ...base, isOnline: true }, NOW)[1]?.text).toContain('6:00 PM online.')
  })

  it('leaves out event replies with nothing to say', () => {
    const replies = buildQuickReplies(
      {
        kind: 'event',
        title: 'Spring market',
        startsAt: null,
        timezone: null,
        venueName: null,
        isOnline: false,
        ticketUrl: null,
        pageUrl: null,
      },
      NOW
    )
    expect(ids(replies)).toEqual(['event-sold-out'])
  })

  it('fills customer replies from the page', () => {
    const replies = buildQuickReplies(
      {
        kind: 'customer',
        businessName: 'Blacq Coffee',
        hours: null,
        mainButton: { label: 'Book now', value: 'https://book.example.com' },
      },
      NOW
    )
    expect(ids(replies)).toEqual(['customer-main-button', 'customer-thanks'])
    expect(replies[0]?.text).toBe('Book now: https://book.example.com')
    expect(replies[1]?.text).toContain('Blacq Coffee')
  })
})

describe('summarizeHours', () => {
  const day = (open: string, close: string) => ({ open, close, closed: false })
  const closed = { open: '', close: '', closed: true }

  it('groups days with the same hours', () => {
    const hours = {
      monday: day('09:00', '17:00'),
      tuesday: day('09:00', '17:00'),
      wednesday: day('09:00', '17:00'),
      thursday: day('09:00', '17:00'),
      friday: day('09:00', '17:00'),
      saturday: day('10:00', '14:30'),
      sunday: closed,
    } as WeeklyHours
    expect(summarizeHours(hours)).toBe('Mon–Fri 9am–5pm, Sat 10am–2:30pm, closed Sun')
  })

  it('is null when every day is closed or the hours are unusable', () => {
    const allClosed = Object.fromEntries(
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((d) => [d, closed])
    ) as unknown as WeeklyHours
    expect(summarizeHours(allClosed)).toBeNull()
    expect(summarizeHours({ ...allClosed, monday: day('late', '17:00') })).toBeNull()
    expect(summarizeHours({ monday: day('09:00', '17:00') } as unknown as WeeklyHours)).toBeNull()
  })
})

describe('savedRepliesFor', () => {
  it("keeps the thread's kind plus any", () => {
    const replies = [
      { id: '1', kind: 'any' as const },
      { id: '2', kind: 'job' as const },
      { id: '3', kind: 'event' as const },
      { id: '4', kind: 'customer' as const },
    ]
    expect(savedRepliesFor(replies, 'job').map((r) => r.id)).toEqual(['1', '2'])
    expect(savedRepliesFor(replies, 'customer').map((r) => r.id)).toEqual(['1', '4'])
  })
})

describe('insertReply', () => {
  it('fills an empty box, and adds after what is there', () => {
    expect(insertReply('', 'Hello')).toBe('Hello')
    expect(insertReply('  \n', 'Hello')).toBe('Hello')
    expect(insertReply('Hi Sam,  \n', 'Hello')).toBe('Hi Sam,\n\nHello')
  })

  it('never goes over the message limit', () => {
    expect(insertReply('x'.repeat(MESSAGE_MAX_LENGTH - 5), 'Hello there')).toHaveLength(MESSAGE_MAX_LENGTH)
  })
})
