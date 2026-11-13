// =============================================================================
// Customer → business messaging (2026-11-13): the pure rules.
// =============================================================================
// Every decision the listing page and the server actions make about who may
// message whom lives in lib/messaging/rules.ts, so it is pinned here without a
// database. The actions' wiring to these rules (flag, rate limits, service
// client) is pinned by source text in tests/messaging-contracts.test.ts.
// =============================================================================

import { describe, expect, it } from 'vitest'

import {
  isConversationUnread,
  isUuid,
  messagePreview,
  messagingCtaLabel,
  normalizeMessageBody,
  parseReportInput,
  participantRole,
  reportPriority,
  resolveListingMessaging,
  type ResolveListingMessagingInput,
} from '@/lib/messaging/rules'
import { MESSAGE_MAX_LENGTH, MESSAGE_PREVIEW_LENGTH, REPORT_NOTE_MAX_LENGTH } from '@/lib/messaging/constants'
import { formatListTime, formatMessageTime } from '@/lib/messaging/format'
import {
  getCtaHref,
  getEntityCtaLabel,
  getSecondaryMessageHref,
  isMessagingUnavailable,
} from '@/components/entity-page/templates/cta'
import type { CTAType, EntityPageData } from '@/types'

const LISTING = '11111111-1111-4111-8111-111111111111'
const OWNER = '22222222-2222-4222-8222-222222222222'
const CUSTOMER = '33333333-3333-4333-8333-333333333333'
const CONVO = '44444444-4444-4444-8444-444444444444'
const PATH = '/detroit/business/blacq-coffee'

function input(overrides: Partial<ResolveListingMessagingInput> = {}): ResolveListingMessagingInput {
  return {
    listingId: LISTING,
    listingPath: PATH,
    ownerUserId: OWNER,
    messagingEnabled: true,
    viewerId: CUSTOMER,
    restricted: false,
    existingConversationId: null,
    ...overrides,
  }
}

describe('resolveListingMessaging', () => {
  it('returns undefined for an unclaimed listing, so the old CTA logic stands', () => {
    expect(resolveListingMessaging(input({ ownerUserId: null }))).toBeUndefined()
  })

  it('sends the owner to their inbox for this page, open or closed', () => {
    for (const messagingEnabled of [true, false]) {
      expect(resolveListingMessaging(input({ viewerId: OWNER, messagingEnabled }))).toEqual({
        mode: 'owner',
        href: `/dashboard/messages?listing=${LISTING}`,
      })
    }
  })

  it('sends a signed-out visitor to sign in and back when the inbox is open', () => {
    expect(resolveListingMessaging(input({ viewerId: null }))).toEqual({
      mode: 'sign_in',
      href: `/sign-in?next=${encodeURIComponent(PATH)}`,
    })
  })

  it('shows unavailable to a signed-out visitor when the inbox is closed', () => {
    expect(resolveListingMessaging(input({ viewerId: null, messagingEnabled: false }))).toEqual({
      mode: 'unavailable',
      href: null,
    })
  })

  it('opens the composer for a signed-in customer when the inbox is open', () => {
    expect(resolveListingMessaging(input())).toEqual({ mode: 'compose', href: '#send-message' })
  })

  it('shows unavailable when the inbox is closed and there is no thread yet', () => {
    expect(resolveListingMessaging(input({ messagingEnabled: false }))?.mode).toBe('unavailable')
  })

  it('links an existing thread even after the inbox closes (existing threads stay open)', () => {
    expect(resolveListingMessaging(input({ messagingEnabled: false, existingConversationId: CONVO }))).toEqual({
      mode: 'thread',
      href: `/account/messages/${CONVO}`,
    })
  })

  it('shows a blocked or suspended customer the same neutral unavailable state, even with a thread', () => {
    for (const existingConversationId of [null, CONVO]) {
      expect(resolveListingMessaging(input({ restricted: true, existingConversationId }))).toEqual({
        mode: 'unavailable',
        href: null,
      })
    }
  })
})

describe('messagingCtaLabel', () => {
  it('relabels only the owner and thread modes', () => {
    expect(messagingCtaLabel('owner', 'Send Message')).toBe('View inbox')
    expect(messagingCtaLabel('thread', 'Send Message')).toBe('View messages')
    expect(messagingCtaLabel('compose', 'Send Message')).toBe('Send Message')
    expect(messagingCtaLabel('sign_in', 'Send Message')).toBe('Send Message')
  })
})

// ── Listing CTA wiring ──────────────────────────────────────────────────────

function entity(cta_type: CTAType, messaging?: EntityPageData['messaging']): EntityPageData {
  return {
    entity_type: 'business',
    messaging,
    details: {
      cta_type,
      cta_url: 'hello@biz.com',
      cta_label_override: null,
      phone: null,
      email: null,
      address: null,
      hours: null,
    },
  } as unknown as EntityPageData
}

describe('getCtaHref — message CTA', () => {
  it('uses the in-app href when messaging resolved for the viewer', () => {
    expect(getCtaHref(entity('message', { mode: 'compose', href: '#send-message' }))).toBe('#send-message')
  })

  it('returns null (no dead button) when the inbox is unavailable', () => {
    expect(getCtaHref(entity('message', { mode: 'unavailable', href: null }))).toBeNull()
  })

  it('keeps the mailto: fallback for unclaimed listings (messaging undefined)', () => {
    expect(getCtaHref(entity('message'))).toBe('mailto:hello@biz.com')
  })
})

describe('message CTA helpers', () => {
  it('flags unavailable only for message CTAs', () => {
    expect(isMessagingUnavailable(entity('message', { mode: 'unavailable', href: null }))).toBe(true)
    expect(isMessagingUnavailable(entity('book', { mode: 'unavailable', href: null }))).toBe(false)
    expect(isMessagingUnavailable(entity('message'))).toBe(false)
  })

  it('relabels the primary CTA for owners', () => {
    expect(getEntityCtaLabel(entity('message', { mode: 'owner', href: '/dashboard/messages' }))).toBe('View inbox')
  })

  it('offers a secondary Message link when the primary CTA is something else', () => {
    expect(getSecondaryMessageHref(entity('book', { mode: 'compose', href: '#send-message' }))).toBe(
      '#send-message'
    )
    expect(getSecondaryMessageHref(entity('book', { mode: 'thread', href: '/account/messages/x' }))).toBe(
      '/account/messages/x'
    )
  })

  it('offers no secondary link to owners, when unavailable, or when the primary CTA is already message', () => {
    expect(getSecondaryMessageHref(entity('book', { mode: 'owner', href: '/dashboard/messages' }))).toBeNull()
    expect(getSecondaryMessageHref(entity('book', { mode: 'unavailable', href: null }))).toBeNull()
    expect(getSecondaryMessageHref(entity('message', { mode: 'compose', href: '#send-message' }))).toBeNull()
    expect(getSecondaryMessageHref(entity('book'))).toBeNull()
  })
})

// ── Bodies ──────────────────────────────────────────────────────────────────

describe('normalizeMessageBody', () => {
  it('rejects non-strings and blank messages', () => {
    expect(normalizeMessageBody(undefined).ok).toBe(false)
    expect(normalizeMessageBody('   \n  ').ok).toBe(false)
  })

  it('trims the ends and normalizes line endings but keeps inner line breaks', () => {
    expect(normalizeMessageBody('  Hi there\r\nAre you open Sunday?  ')).toEqual({
      ok: true,
      body: 'Hi there\nAre you open Sunday?',
    })
  })

  it(`accepts exactly ${MESSAGE_MAX_LENGTH} characters and rejects one more`, () => {
    expect(normalizeMessageBody('a'.repeat(MESSAGE_MAX_LENGTH)).ok).toBe(true)
    expect(normalizeMessageBody('a'.repeat(MESSAGE_MAX_LENGTH + 1)).ok).toBe(false)
  })
})

describe('messagePreview', () => {
  it('flattens whitespace', () => {
    expect(messagePreview('Hi\n\nthere   friend')).toBe('Hi there friend')
  })

  it(`caps at ${MESSAGE_PREVIEW_LENGTH} characters with an ellipsis (fits the DB CHECK)`, () => {
    const p = messagePreview('x'.repeat(500))
    expect(p.length).toBe(MESSAGE_PREVIEW_LENGTH)
    expect(p.endsWith('…')).toBe(true)
  })
})

// ── Participants and unread ─────────────────────────────────────────────────

describe('participantRole', () => {
  const conv = { customer_user_id: CUSTOMER }
  it('identifies each side and rejects everyone else', () => {
    expect(participantRole(CUSTOMER, conv, OWNER)).toBe('customer')
    expect(participantRole(OWNER, conv, OWNER)).toBe('owner')
    expect(participantRole('55555555-5555-4555-8555-555555555555', conv, OWNER)).toBeNull()
  })

  it('has no owner side once the listing loses its owner', () => {
    expect(participantRole(OWNER, conv, null)).toBeNull()
  })
})

describe('isConversationUnread', () => {
  const at = '2026-11-13T15:00:00.000Z'
  it('is unread when this side never read it', () => {
    expect(isConversationUnread('owner', { last_message_at: at, customer_last_read_at: at, owner_last_read_at: null })).toBe(
      true
    )
  })

  it("is read for the sender, whose marker is stamped with the message's own instant", () => {
    expect(isConversationUnread('customer', { last_message_at: at, customer_last_read_at: at, owner_last_read_at: null })).toBe(
      false
    )
  })

  it('is unread when the thread moved after this side read it', () => {
    expect(
      isConversationUnread('customer', {
        last_message_at: at,
        customer_last_read_at: '2026-11-13T14:59:59.000Z',
        owner_last_read_at: at,
      })
    ).toBe(true)
  })
})

// ── Reports ─────────────────────────────────────────────────────────────────

describe('parseReportInput', () => {
  it('accepts the five reasons and nothing else', () => {
    for (const r of ['spam', 'harassment', 'scam', 'inappropriate', 'other']) {
      expect(parseReportInput(r, '').ok).toBe(true)
    }
    expect(parseReportInput('rude', '').ok).toBe(false)
    expect(parseReportInput(undefined, '').ok).toBe(false)
  })

  it('stores a blank note as null and caps notes', () => {
    expect(parseReportInput('spam', '   ')).toEqual({ ok: true, value: { reason: 'spam', note: null } })
    expect(parseReportInput('spam', 'n'.repeat(REPORT_NOTE_MAX_LENGTH)).ok).toBe(true)
    expect(parseReportInput('spam', 'n'.repeat(REPORT_NOTE_MAX_LENGTH + 1)).ok).toBe(false)
  })

  it('ranks harassment and scam above the rest', () => {
    expect(reportPriority('harassment')).toBe(2)
    expect(reportPriority('scam')).toBe(2)
    expect(reportPriority('spam')).toBe(1)
    expect(reportPriority('other')).toBe(1)
  })
})

describe('isUuid', () => {
  it('accepts UUIDs only', () => {
    expect(isUuid(CONVO)).toBe(true)
    expect(isUuid('not-a-uuid')).toBe(false)
    expect(isUuid(`${CONVO}' OR 1=1`)).toBe(false)
    expect(isUuid(42)).toBe(false)
  })
})

// ── Times ───────────────────────────────────────────────────────────────────

describe('formatListTime / formatMessageTime (America/New_York)', () => {
  const now = new Date('2026-11-13T20:00:00.000Z') // 3:00 PM ET

  it('shows a time for today in New York, not in UTC', () => {
    expect(formatListTime('2026-11-13T19:42:00.000Z', now)).toBe('2:42 PM')
  })

  it('treats 1 AM UTC as the previous New York day', () => {
    expect(formatListTime('2026-11-13T01:00:00.000Z', now)).toBe('Nov 12')
  })

  it('adds the year for earlier years', () => {
    expect(formatListTime('2025-11-12T17:00:00.000Z', now)).toBe('Nov 12, 2025')
  })

  it('labels thread times as ET', () => {
    expect(formatMessageTime('2026-11-13T19:42:00.000Z')).toBe('Nov 13, 2:42 PM ET')
  })
})
