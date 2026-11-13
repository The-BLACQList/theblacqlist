// =============================================================================
// Happening now posts (owner-experience round 2, part F, 2026-11-13).
// =============================================================================

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import {
  DEFAULT_POST_BUTTON,
  POST_MAX_DAYS,
  STRIP_LIMIT,
  countsTowardLimit,
  endsLabel,
  isLive,
  isUploadedPostImagePath,
  parsePost,
  postClickHref,
  postState,
  shownPosts,
  toOwnerPosts,
  toPublicPost,
  type OwnerPost,
} from '@/lib/listings/happeningNow'
import { toStripPosts } from '@/lib/listings/happeningNowFeed'
import { activePostLimit } from '@/lib/stripe/features'
import { checkPostAdd } from '@/lib/stripe/planChecks'

const root = join(__dirname, '..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const NOW = new Date('2026-11-13T12:00:00.000Z')
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString()

const LISTING = '11111111-1111-4111-8111-111111111111'
const FILE = '22222222-2222-4222-8222-222222222222'

function post(id: string, overrides: Partial<OwnerPost> = {}): OwnerPost {
  return {
    id,
    headline: `Post ${id}`,
    body: null,
    image_path: null,
    button_label: null,
    button_url: null,
    starts_at: at(-DAY),
    ends_at: at(DAY),
    status: 'active',
    created_at: at(-2 * DAY),
    ...overrides,
  }
}

// ── Plan limits ─────────────────────────────────────────────────────────────

describe('activePostLimit', () => {
  it('is 0 / 1 / 3 / 5 by plan, and Free for anything unknown', () => {
    expect(activePostLimit('free')).toBe(0)
    expect(activePostLimit('starter')).toBe(1)
    expect(activePostLimit('growth')).toBe(3)
    expect(activePostLimit('premium')).toBe(5)
    expect(activePostLimit(null)).toBe(0)
    expect(activePostLimit('lapsed')).toBe(0)
  })
})

describe('checkPostAdd', () => {
  it('blocks Free with a Starter note', () => {
    expect(checkPostAdd('free', 0)).toMatch(/part of Starter/)
  })

  it('allows posts up to the limit and blocks the next one', () => {
    expect(checkPostAdd('starter', 0)).toBeNull()
    expect(checkPostAdd('starter', 1)).toMatch(/1 post at a time/)
    expect(checkPostAdd('growth', 2)).toBeNull()
    expect(checkPostAdd('growth', 3)).toMatch(/up to 3 posts at a time/)
  })

  it('lets Premium post 5, with no upgrade to offer', () => {
    expect(checkPostAdd('premium', 4, true, true)).toBeNull()
    expect(checkPostAdd('premium', 5, true, true)).toBe(
      'Your plan includes up to 5 posts at a time. End one to post another.'
    )
  })

  it('offers the next plan only when it is for sale', () => {
    expect(checkPostAdd('starter', 1, true)).toMatch(/upgrade to Growth/)
    expect(checkPostAdd('growth', 3, true, true)).toMatch(/upgrade to Premium/)
    expect(checkPostAdd('growth', 3, true, false)).toMatch(/End one to post another/)
  })
})

// ── Date windows ────────────────────────────────────────────────────────────

describe('postState / isLive / countsTowardLimit', () => {
  it('is live inside [starts_at, ends_at)', () => {
    expect(postState(post('a'), NOW)).toBe('live')
    expect(postState(post('a', { starts_at: NOW.toISOString() }), NOW)).toBe('live')
    expect(isLive(post('a'), NOW)).toBe(true)
  })

  it('is scheduled before the start, ended at or after the end', () => {
    expect(postState(post('a', { starts_at: at(HOUR), ends_at: at(DAY) }), NOW)).toBe('scheduled')
    expect(postState(post('a', { ends_at: NOW.toISOString() }), NOW)).toBe('ended')
    expect(postState(post('a', { ends_at: at(-HOUR) }), NOW)).toBe('ended')
  })

  it('treats drafts and posts ended early as not showing', () => {
    expect(postState(post('a', { status: 'draft' }), NOW)).toBe('draft')
    expect(postState(post('a', { status: 'ended' }), NOW)).toBe('ended')
    expect(isLive(post('a', { status: 'draft' }), NOW)).toBe(false)
  })

  it('counts live and scheduled posts toward the limit, not drafts or ended ones', () => {
    expect(countsTowardLimit(post('a'), NOW)).toBe(true)
    expect(countsTowardLimit(post('a', { starts_at: at(DAY), ends_at: at(2 * DAY) }), NOW)).toBe(
      true
    )
    expect(countsTowardLimit(post('a', { status: 'draft' }), NOW)).toBe(false)
    expect(countsTowardLimit(post('a', { ends_at: at(-1) }), NOW)).toBe(false)
  })

  it('a bad date never shows', () => {
    expect(isLive(post('a', { ends_at: 'nope' }), NOW)).toBe(false)
  })
})

describe('shownPosts', () => {
  const older = post('older', { created_at: at(-5 * DAY), ends_at: at(5 * DAY) })
  const middle = post('middle', { created_at: at(-4 * DAY), ends_at: at(HOUR) })
  const newer = post('newer', { created_at: at(-3 * DAY), ends_at: at(2 * DAY) })
  const newest = post('newest', { created_at: at(-2 * DAY), ends_at: at(3 * HOUR) })
  const scheduled = post('later', {
    created_at: at(-6 * DAY),
    starts_at: at(DAY),
    ends_at: at(3 * DAY),
  })
  const all = [newest, scheduled, newer, older, middle]

  it('shows nothing on Free', () => {
    const { shown, hidden } = shownPosts(all, 'free', NOW)
    expect(shown).toEqual([])
    expect(hidden.map((p) => p.id)).toEqual(['older', 'middle', 'newer', 'newest'])
  })

  it('keeps the oldest live posts by creation order after a downgrade', () => {
    expect(shownPosts(all, 'starter', NOW).shown.map((p) => p.id)).toEqual(['older'])
    expect(shownPosts(all, 'starter', NOW).hidden.map((p) => p.id)).toEqual([
      'middle',
      'newer',
      'newest',
    ])
  })

  it('returns the shown posts soonest ending first', () => {
    expect(shownPosts(all, 'growth', NOW).shown.map((p) => p.id)).toEqual([
      'middle',
      'newer',
      'older',
    ])
    expect(shownPosts(all, 'premium', NOW).shown.map((p) => p.id)).toEqual([
      'middle',
      'newest',
      'newer',
      'older',
    ])
  })

  it('never shows a scheduled post, whatever the plan', () => {
    expect(shownPosts(all, 'premium', NOW).shown.some((p) => p.id === 'later')).toBe(false)
  })

  it('caps Premium at 5', () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      post(`p${i}`, { created_at: at(-(10 - i) * DAY), ends_at: at((i + 1) * HOUR) })
    )
    const { shown, hidden } = shownPosts(many, 'premium', NOW)
    expect(shown.map((p) => p.id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4'])
    expect(hidden.map((p) => p.id)).toEqual(['p5', 'p6'])
  })

  it('shows posts again on upgrade (nothing is lost)', () => {
    expect(shownPosts(all, 'premium', NOW).hidden).toEqual([])
  })
})

// ── Checking what the owner wrote ───────────────────────────────────────────

describe('parsePost', () => {
  const base = {
    headline: 'Fall pop-up this weekend',
    body: 'Fresh pies at the market.',
    buttonLabel: '',
    buttonUrl: '',
    startsAt: '',
    endsAt: at(3 * DAY),
  }

  it('accepts a plain post and starts it now', () => {
    const r = parsePost(base, NOW)
    expect(r).toEqual({
      ok: true,
      value: {
        headline: 'Fall pop-up this weekend',
        body: 'Fresh pies at the market.',
        button_label: null,
        button_url: null,
        starts_at: NOW.toISOString(),
        ends_at: at(3 * DAY),
      },
    })
  })

  it('keeps each field to one line', () => {
    const r = parsePost({ ...base, headline: '  Fall\npop-up\r\n  now ', body: '\n' }, NOW)
    expect(r.ok && r.value.headline).toBe('Fall pop-up now')
    expect(r.ok && r.value.body).toBeNull()
  })

  it('needs a headline, and keeps it and the text short', () => {
    expect(parsePost({ ...base, headline: '   ' }, NOW).ok).toBe(false)
    expect(parsePost({ ...base, headline: 'x'.repeat(81) }, NOW).ok).toBe(false)
    expect(parsePost({ ...base, body: 'x'.repeat(201) }, NOW).ok).toBe(false)
  })

  it('refuses links in the text', () => {
    for (const text of ['See https://x.co/a', 'Go to www.example.org', 'Order at pies.shop']) {
      expect(parsePost({ ...base, body: text }, NOW)).toEqual({
        ok: false,
        error: 'Put links in the button, not in the text.',
      })
    }
    expect(parsePost({ ...base, headline: 'Visit mybakery.com' }, NOW).ok).toBe(false)
  })

  it('needs https for the button, and a link when the button has words', () => {
    expect(parsePost({ ...base, buttonUrl: 'http://example.com' }, NOW).ok).toBe(false)
    expect(parsePost({ ...base, buttonUrl: 'javascript:alert(1)' }, NOW).ok).toBe(false)
    expect(parsePost({ ...base, buttonLabel: 'Order' }, NOW).ok).toBe(false)
    const r = parsePost(
      { ...base, buttonUrl: 'https://example.com/order', buttonLabel: 'Order' },
      NOW
    )
    expect(r.ok && r.value).toMatchObject({
      button_url: 'https://example.com/order',
      button_label: 'Order',
    })
  })

  it('moves a start in the past to now, unless the post is already running', () => {
    const past = at(-DAY)
    const r = parsePost({ ...base, startsAt: past }, NOW)
    expect(r.ok && r.value.starts_at).toBe(NOW.toISOString())
    const kept = parsePost({ ...base, startsAt: past }, NOW, past)
    expect(kept.ok && kept.value.starts_at).toBe(past)
  })

  it(`runs at most ${POST_MAX_DAYS} days, pulling back an end just past it`, () => {
    const justOver = parsePost({ ...base, endsAt: at(30 * DAY + 10 * 60 * 1000) }, NOW)
    expect(justOver.ok && justOver.value.ends_at).toBe(at(30 * DAY))
    expect(parsePost({ ...base, endsAt: at(31 * DAY) }, NOW)).toEqual({
      ok: false,
      error: 'A post can run for up to 30 days.',
    })
  })

  it('needs an end in the future, after the start', () => {
    expect(parsePost({ ...base, endsAt: '' }, NOW).ok).toBe(false)
    expect(parsePost({ ...base, endsAt: at(-HOUR) }, NOW).ok).toBe(false)
    expect(parsePost({ ...base, startsAt: at(2 * DAY), endsAt: at(DAY) }, NOW).ok).toBe(false)
  })

  it('schedules up to 60 days ahead', () => {
    expect(parsePost({ ...base, startsAt: at(59 * DAY), endsAt: at(60 * DAY) }, NOW).ok).toBe(true)
    expect(parsePost({ ...base, startsAt: at(61 * DAY), endsAt: at(62 * DAY) }, NOW).ok).toBe(false)
  })
})

// ── Display helpers ─────────────────────────────────────────────────────────

describe('isUploadedPostImagePath', () => {
  it("accepts only an upload under this listing's post folder", () => {
    expect(isUploadedPostImagePath(LISTING, `listings/${LISTING}/post/${FILE}.webp`)).toBe(true)
    expect(isUploadedPostImagePath(LISTING, `listings/${FILE}/post/${FILE}.webp`)).toBe(false)
    expect(isUploadedPostImagePath(LISTING, `listings/${LISTING}/gallery/${FILE}.webp`)).toBe(false)
    expect(isUploadedPostImagePath(LISTING, `listings/${LISTING}/post/../${FILE}.webp`)).toBe(false)
    expect(isUploadedPostImagePath(LISTING, `listings/${LISTING}/post/${FILE}.svg`)).toBe(false)
    expect(isUploadedPostImagePath(LISTING, null)).toBe(false)
    expect(isUploadedPostImagePath('not-a-uuid', `listings/not-a-uuid/post/${FILE}.jpg`)).toBe(
      false
    )
  })
})

describe('endsLabel', () => {
  it('counts from now', () => {
    expect(endsLabel(at(-1), NOW)).toBe('Ended')
    expect(endsLabel(at(30 * 60 * 1000), NOW)).toBe('Ends within the hour')
    expect(endsLabel(at(5 * HOUR), NOW)).toBe('Ends in 5 hours')
    expect(endsLabel(at(DAY), NOW)).toBe('Ends tomorrow')
    expect(endsLabel(at(5 * DAY), NOW)).toBe('Ends in 5 days')
    expect(endsLabel('nope', NOW)).toBe('Ended')
  })
})

describe('toPublicPost / postClickHref / toOwnerPosts', () => {
  it('gives a button only when there is a link, with default words', () => {
    const url = (p: string) => `https://cdn/${p}`
    expect(toPublicPost(post('a'), url).buttonLabel).toBeNull()
    expect(toPublicPost(post('a', { button_url: 'https://x.com' }), url).buttonLabel).toBe(
      DEFAULT_POST_BUTTON
    )
    expect(
      toPublicPost(post('a', { button_url: 'https://x.com', button_label: 'Order' }), url)
        .buttonLabel
    ).toBe('Order')
    expect(toPublicPost(post('a', { image_path: 'p.jpg' }), url).imageUrl).toBe('https://cdn/p.jpg')
  })

  it('never puts the button URL in the public post', () => {
    const pub = toPublicPost(post('a', { button_url: 'https://secret.example' }), () => null)
    expect(JSON.stringify(pub)).not.toContain('secret.example')
  })

  it('routes clicks through the counting endpoint', () => {
    expect(postClickHref('abc', 'page')).toBe('/api/happening-now/abc?from=page')
    expect(postClickHref('a/b', 'strip')).toBe('/api/happening-now/a%2Fb?from=strip')
  })

  it('drops malformed rows', () => {
    expect(toOwnerPosts(null)).toEqual([])
    expect(
      toOwnerPosts([post('a'), { id: 'b' }, { ...post('c'), status: 'weird' }]).map((p) => p.id)
    ).toEqual(['a'])
  })
})

describe('toStripPosts', () => {
  function row(id: string, listingId: string, tier: string, overrides: Partial<OwnerPost> = {}) {
    return {
      ...post(id, overrides),
      listing_id: listingId,
      listings: {
        id: listingId,
        name: `Biz ${listingId}`,
        slug: `biz-${listingId}`,
        entity_type: 'restaurant',
        tier,
        logo_path: null,
        cities: { slug: 'atlanta' },
      },
    }
  }

  it("applies each page's plan, then keeps the soonest ending", () => {
    const rows = [
      row('s1', 'starter-page', 'starter', { ends_at: at(HOUR), created_at: at(-DAY) }),
      row('s2', 'starter-page', 'starter', { ends_at: at(2 * HOUR), created_at: at(-3 * DAY) }),
      row('f1', 'free-page', 'free', { ends_at: at(30 * 60 * 1000) }),
      row('p1', 'premium-page', 'premium', { ends_at: at(3 * HOUR) }),
    ]
    const out = toStripPosts(rows, NOW)
    // Starter keeps its oldest post (s2), Free shows none.
    expect(out.map((i) => i.post.id)).toEqual(['s2', 'p1'])
    expect(out[0]?.listing.href).toBe('/atlanta/restaurant/biz-starter-page')
  })

  it(`shows at most ${STRIP_LIMIT}`, () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      row(`p${i}`, `page-${i}`, 'premium', { ends_at: at((12 - i) * HOUR) })
    )
    const out = toStripPosts(rows, NOW)
    expect(out).toHaveLength(STRIP_LIMIT)
    expect(out[0]?.post.id).toBe('p11')
  })
})

// ── Contracts ───────────────────────────────────────────────────────────────

describe('migration 20261116000000_listing_posts', () => {
  const sql = read('supabase/migrations/20261116000000_listing_posts.sql')

  it('keeps the limits the app checks', () => {
    expect(sql).toContain("CHECK (status IN ('draft', 'active', 'ended'))")
    expect(sql).toContain('BETWEEN 1 AND 80')
    expect(sql).toContain('BETWEEN 1 AND 200')
    expect(sql).toContain("ends_at <= starts_at + interval '30 days'")
    expect(sql).toContain("button_url ~* '^https://'")
    expect(sql).toContain("LIKE 'listings/' || listing_id::text || '/post/%'")
  })

  it('lets the public read only live posts on published pages', () => {
    expect(sql).toContain('ENABLE ROW LEVEL SECURITY')
    const anon = sql.slice(
      sql.indexOf('"listing_posts: anon read live" ON'),
      sql.indexOf('-- Authenticated')
    )
    expect(anon).toContain("status = 'active'")
    expect(anon).toContain('starts_at <= now()')
    expect(anon).toContain('ends_at > now()')
    expect(anon).toContain("status = 'published' AND deleted_at IS NULL")
  })

  it('has a down plan', () => {
    expect(sql).toMatch(/Down:\s*\n--\s+DROP TABLE IF EXISTS public\.listing_posts;/)
  })
})

describe('wiring', () => {
  it('the actions check the flag, the owner and the plan', () => {
    const src = read('lib/actions/dashboard/posts.ts')
    expect(src).toContain("isFeatureEnabled('happeningNow')")
    expect(src).toContain('getOwnerSession()')
    expect(src).toContain('checkPostAdd(')
    expect(src).toContain('isUploadedPostImagePath(')
  })

  it('the click route is flagged, counts the click and is kept out of search', () => {
    const src = read('app/api/happening-now/[postId]/route.ts')
    expect(src).toContain("isFeatureEnabled('happeningNow')")
    expect(src).toContain('SERVER_ONLY_EVENTS.POST_CLICK')
    expect(src).toContain('X-Robots-Tag')
  })

  it('banner and strip use plain counted links, never next/link', () => {
    for (const file of [
      'components/entity-page/HappeningNowBanner.tsx',
      'components/discovery/HappeningNowStrip.tsx',
    ]) {
      const src = read(file)
      expect(src).toContain('postClickHref(')
      expect(src).not.toContain("from 'next/link'")
      expect(src).toContain('rel="nofollow')
    }
  })

  it('views are counted on the page and the strip', () => {
    expect(read('app/[citySlug]/[entityType]/[listingSlug]/page.tsx')).toContain(
      'SERVER_ONLY_EVENTS.POST_VIEW'
    )
    expect(read('components/discovery/HappeningNowStrip.tsx')).toContain(
      'SERVER_ONLY_EVENTS.POST_VIEW'
    )
  })

  it('the page read is flagged and capped by plan', () => {
    const src = read('lib/listings/entityPage.ts')
    expect(src).toContain("isFeatureEnabled('happeningNow')")
    expect(src).toContain('shownPosts(')
  })

  it('the sidebar link, the Basics card and the analytics counts are behind the flag', () => {
    expect(read('app/dashboard/layout.tsx')).toContain(
      "showPosts={isFeatureEnabled('happeningNow')}"
    )
    expect(read('lib/listings/editTabs.ts')).toContain("'happening-now'")
    const analytics = read('app/dashboard/pages/[entityId]/analytics/page.tsx')
    expect(analytics).toContain("isFeatureEnabled('happeningNow')")
    expect(analytics).toContain('SERVER_ONLY_EVENTS.POST_CLICK')
  })
})
