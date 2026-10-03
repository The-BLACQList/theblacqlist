import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { editorialKind } from '@/lib/editorial/kind'
import { readMinutes } from '@/lib/editorial/readTime'
import { classifyHref, firstPullQuote, parseInline, stripInline } from '@/lib/editorial/inline'
import {
  linkedListingSlugs,
  orderLinkedListings,
  type LinkedListingRow,
} from '@/lib/editorial/linkedListings'

// Tickets 116 and 117, The BLACQLight cover-story index and article page.

describe('editorialKind', () => {
  it('maps a known tag to its kind', () => {
    expect(editorialKind(['founder', 'why we exist'])).toBe('Founder story')
    expect(editorialKind(['Profiles'])).toBe('Profile')
    expect(editorialKind(['movement'])).toBe('Movement')
    expect(editorialKind(['  GUIDE  '])).toBe('Guide')
  })

  it('returns the first matching tag', () => {
    expect(editorialKind(['community', 'guide', 'profile'])).toBe('Guide')
  })

  it('returns null when nothing maps', () => {
    expect(editorialKind(['pages', 'owners'])).toBeNull()
    expect(editorialKind([])).toBeNull()
    expect(editorialKind(null)).toBeNull()
    expect(editorialKind(undefined)).toBeNull()
  })
})

describe('readMinutes', () => {
  const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ')

  it('is at least one minute', () => {
    expect(readMinutes('')).toBe(1)
    expect(readMinutes(null)).toBe(1)
    expect(readMinutes('short')).toBe(1)
  })

  it('rounds up at 230 words a minute', () => {
    expect(readMinutes(words(230))).toBe(1)
    expect(readMinutes(words(231))).toBe(2)
    expect(readMinutes(words(460))).toBe(2)
    expect(readMinutes(words(461))).toBe(3)
  })
})

describe('classifyHref', () => {
  it('treats a site path as internal', () => {
    expect(classifyHref('/houston/restaurant/peach-and-rye')).toBe('internal')
    expect(classifyHref('/discover')).toBe('internal')
  })

  it('treats an https URL as external', () => {
    expect(classifyHref('https://example.com/story')).toBe('external')
  })

  it('refuses every other scheme', () => {
    expect(classifyHref('javascript:alert(1)')).toBeNull()
    expect(classifyHref('JavaScript:alert(1)')).toBeNull()
    expect(classifyHref('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(classifyHref('http://example.com')).toBeNull()
    expect(classifyHref('mailto:someone@example.com')).toBeNull()
    expect(classifyHref('not a url')).toBeNull()
  })

  it('refuses protocol-relative paths', () => {
    expect(classifyHref('//evil.example')).toBeNull()
    expect(classifyHref('/\\evil.example')).toBeNull()
  })
})

describe('parseInline', () => {
  it('splits text and links in order', () => {
    expect(parseInline('Visit [Peach & Rye](/houston/restaurant/peach-and-rye) today.')).toEqual([
      { type: 'text', text: 'Visit ' },
      {
        type: 'link',
        text: 'Peach & Rye',
        href: '/houston/restaurant/peach-and-rye',
        kind: 'internal',
      },
      { type: 'text', text: ' today.' },
    ])
  })

  it('keeps an external link', () => {
    expect(parseInline('[read more](https://example.com)')).toEqual([
      { type: 'link', text: 'read more', href: 'https://example.com', kind: 'external' },
    ])
  })

  it('renders an unsafe link as its text only', () => {
    const tokens = parseInline('Click [here](javascript:alert(1)) now')
    expect(tokens.some((t) => t.type === 'link')).toBe(false)
    expect(tokens.map((t) => t.text).join('')).not.toContain('javascript')
  })

  it('leaves plain text alone', () => {
    expect(parseInline('No links here.')).toEqual([{ type: 'text', text: 'No links here.' }])
    expect(stripInline('A [link](/discover) inside')).toBe('A link inside')
  })
})

describe('firstPullQuote', () => {
  it('returns the first blockquote as plain text', () => {
    const body = 'Intro.\n\n> Spend where it [matters](/discover).\n\n> Second quote.'
    expect(firstPullQuote(body)).toBe('Spend where it matters.')
  })

  it('returns null with no blockquote', () => {
    expect(firstPullQuote('Just a paragraph.\n\nAnother.')).toBeNull()
    expect(firstPullQuote(null)).toBeNull()
  })
})

describe('linkedListingSlugs', () => {
  it('pulls listing slugs from internal listing links, deduped in order', () => {
    const bodies = [
      'See [A](/houston/restaurant/peach-and-rye) and [B](/atlanta/business/sweet-auburn-bread).',
      'Again [A](/houston/restaurant/peach-and-rye) and [C](/online/business/web-shop/).',
    ]
    expect(linkedListingSlugs(bodies)).toEqual(['peach-and-rye', 'sweet-auburn-bread', 'web-shop'])
  })

  it('ignores external links, non-listing paths, and unknown entity types', () => {
    const body = [
      '[ext](https://example.com/houston/business/not-this)',
      '[discover](/discover)',
      '[bad type](/houston/spaceship/nope)',
      '[unsafe](javascript:alert(1))',
    ].join(' ')
    expect(linkedListingSlugs([body, null, undefined])).toEqual([])
  })
})

describe('orderLinkedListings', () => {
  const row = (slug: string, over: Partial<LinkedListingRow> = {}): LinkedListingRow => ({
    id: `id-${slug}`,
    slug,
    name: slug,
    entity_type: 'business',
    status: 'published',
    deleted_at: null,
    trust_tier: 'claimed',
    ownership_label: 'black_owned',
    categories: { name: 'Bakery' },
    cities: { name: 'Atlanta', slug: 'atlanta', states: { code: 'GA' } },
    ...over,
  })

  it('keeps the order the story linked them and builds the page URL', () => {
    const out = orderLinkedListings([row('b'), row('a')], ['a', 'b'], 6)
    expect(out.map((l) => l.slug)).toEqual(['a', 'b'])
    expect(out[0]).toMatchObject({
      href: '/atlanta/business/a',
      category: 'Bakery',
      city: 'Atlanta, GA',
    })
  })

  it('drops unpublished and deleted listings', () => {
    const rows = [
      row('draft', { status: 'pending' }),
      row('gone', { deleted_at: '2026-10-01T00:00:00Z' }),
      row('live'),
    ]
    expect(orderLinkedListings(rows, ['draft', 'gone', 'live'], 6).map((l) => l.slug)).toEqual([
      'live',
    ])
  })

  it('respects the limit and skips slugs with no row', () => {
    const rows = [row('a'), row('b'), row('c'), row('d')]
    expect(
      orderLinkedListings(rows, ['missing', 'a', 'b', 'c', 'd'], 3).map((l) => l.slug)
    ).toEqual(['a', 'b', 'c'])
  })

  it('handles a listing with no city', () => {
    const [l] = orderLinkedListings([row('web', { cities: null, categories: null })], ['web'], 1)
    expect(l).toMatchObject({ href: '/online/business/web', city: null, category: null })
  })
})

describe('copy style', () => {
  it('uses no em dashes in the new BLACQLight files', () => {
    const files = [
      'app/(public)/blacqlight/(index)/page.tsx',
      'app/(public)/blacqlight/(index)/loading.tsx',
      'app/(public)/blacqlight/[slug]/page.tsx',
      'lib/editorial/kind.ts',
      'lib/editorial/readTime.ts',
      'lib/editorial/inline.ts',
      'lib/editorial/linkedListings.ts',
    ]
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toContain('—')
  })
})
