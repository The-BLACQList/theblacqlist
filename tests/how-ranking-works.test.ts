// =============================================================================
// /how-ranking-works must describe the ranking the database actually applies
// =============================================================================
// The page's own contract, stated in its JSDoc: "The order of the sections below
// mirrors the actual ORDER BY in search_listings_faceted. If the ranking
// changes, this page changes in the same PR." A disclosure page that drifts from
// the code is worse than no disclosure page, so this test is the mechanism that
// makes the promise enforceable rather than aspirational.
//
// What it guards, and why each line is here:
//
//   • Section order. The page is read top to bottom as "this is the order we
//     apply them", so the section ids have to match the ORDER BY sequence:
//     sponsored -> match band -> activity -> paid tier.
//
//   • The removed ownership key. Until 20260923000000_activity_ranking.sql the
//     second ORDER BY key was `(ownership_label = 'black_owned') DESC`, and the
//     page asserted it in FOUR places (sections 2, 4, 5 and 6), not one. The
//     founder's decision removed the key
//     [Decision - founder, 2026-09-21, refined 2026-09-23]. If any of those
//     sentences comes back without the key coming back, the page is lying about
//     how results are ordered; if the key comes back without the sentences, it
//     is lying by omission. Both directions fail here.
//
//   • The label-neutrality sentence. This is the one claim on the page that a
//     business owner is most likely to test and most likely to care about, and
//     it is the claim moderation-policy.md:48 depends on ("no paid tier,
//     placement, or badge is contingent on the label"). It does not get quietly
//     softened.
//
//   • The two "never outranks" claims about a subscription. These bound what
//     money buys. They are true only because tier_weight sits BELOW match_band
//     and activity_score in the ORDER BY, so the cross-file check below reads
//     the real key order rather than trusting the prose.
//
//   • Em dashes. Every user-facing string on this site avoids them; the JSDoc is
//     exempt and is stripped before the check.
// =============================================================================

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8')

const PAGE = 'app/(public)/how-ranking-works/page.tsx'
const MIGRATION = 'supabase/migrations/20260923000000_activity_ranking.sql'

describe('how-ranking-works page', () => {
  const src = read(PAGE)

  // Prose assertions run against the user-facing copy only, with the JSDoc
  // stripped and whitespace collapsed. Two reasons, both learned the hard way:
  // the JSDoc quotes the very sentences this test requires to be GONE from the
  // page, and Prettier rewraps a sentence across lines whenever a word is
  // edited, which would turn every copy guard into a formatting tripwire.
  const copy = src.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')

  it('presents the factors in the order the ORDER BY applies them', () => {
    const ids = [...src.matchAll(/<section id="([a-z-]+)"/g)].map((m) => m[1] ?? '')
    // `questions` is the contact footer, not a ranking factor, so it trails.
    expect(ids).toEqual([
      'sponsored',
      'match',
      'activity',
      'subscription',
      'never',
      'sorting',
      'questions',
    ])
  })

  it('names activity as the factor that orders results', () => {
    expect(copy).toContain('how active and well-kept the business is')
    // The signals the page promises are exactly the ones refresh_activity_scores
    // reads. A reader who checks should find all five.
    expect(copy).toContain('People saving the business.')
    expect(copy).toContain('Published reviews, with a good average rating counting for more.')
    expect(copy).toContain('Recent visits to the listing.')
    expect(copy).toContain('An owner replying to the reviews they receive.')
    expect(copy).toContain('claiming or verifying it')
  })

  it('states the 90 day window and the nightly recalculation', () => {
    // Both are checkable facts about the function: ranking_weights.window_days
    // is 90, and the refresh is called from the nightly aggregate.
    expect(copy).toContain('Only the last 90 days count')
    expect(copy).toContain('recalculate the whole directory once a night')
  })

  it('states that the ownership label does not affect order', () => {
    expect(copy).toContain('The ownership label is not part of this, in either direction.')
    expect(copy).toContain('neither label moves a business up')
    expect(copy).toContain('it does not change the order of results')
  })

  it('no longer claims the ownership label changes the order', () => {
    // The four sentences the old page carried. Each asserted the removed key.
    expect(copy).not.toMatch(/listed below/i)
    expect(copy).not.toMatch(/centered/i)
    expect(copy).not.toMatch(/above a Black-owned/i)
    expect(copy).not.toMatch(/then the Allies/i)
  })

  it('keeps sponsored placement first and labeled', () => {
    expect(copy).toContain('Sponsored placements come first, and they are always labeled')
    expect(copy).toContain('If it does not say Sponsored, nobody paid to put it in that position.')
    // Section 6: a chosen sort is honored, but sponsored still sits on top.
    expect(copy).toContain('a labeled Sponsored placement stays at the top')
  })

  it('bounds what a subscription buys', () => {
    expect(copy).toContain('A subscription never outranks a better match, and never outranks a more')
    expect(copy).toContain('It only applies when you actually searched for something.')
    expect(copy).toContain('Growth and Premium get exactly the same weight here.')
    expect(copy).toContain('Activity itself is not for sale.')
  })

  it('uses no em dashes in user-facing copy', () => {
    expect(copy).not.toContain('—')
  })
})

describe('the page matches the ORDER BY it describes', () => {
  const sql = read(MIGRATION)

  // Everything from the final ORDER BY to the LIMIT, comment lines dropped, so
  // the assertions read the live keys and not the prose explaining them.
  const orderBy = (() => {
    const start = sql.lastIndexOf('ORDER BY')
    const end = sql.indexOf('LIMIT GREATEST', start)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    return sql
      .slice(start, end)
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
  })()

  it('has no live ownership_label key', () => {
    // The removal is recorded as a comment in the migration, which is why the
    // comment lines are stripped above rather than searching the whole file.
    expect(orderBy).not.toContain('ownership_label')
  })

  it('orders sponsored, then match band, then activity, then paid tier', () => {
    const at = (needle: string) => {
      const i = orderBy.indexOf(needle)
      expect(i, `${needle} missing from ORDER BY`).toBeGreaterThan(-1)
      return i
    }
    expect(at('c.is_featured')).toBeLessThan(at('c.match_band'))
    expect(at('c.match_band')).toBeLessThan(at('c.activity_score'))
    expect(at('c.activity_score')).toBeLessThan(at('c.tier_weight'))
  })

  it('applies the paid tier key only when a keyword was supplied', () => {
    // Section 4 promises "It only applies when you actually searched for
    // something." That promise is this guard on the tier_weight key.
    expect(orderBy).toMatch(/p_q IS NOT NULL AND p_q <> ''[\s\S]{0,60}THEN c\.tier_weight END/)
  })
})

describe('the browse path mirrors the same order', () => {
  const src = read('lib/services/search.ts')

  it('orders the no-keyword PostgREST branch by activity, not by label', () => {
    // /api/search answers a plain browse through PostgREST, not the RPC. With no
    // keyword the RPC's match_band and rank are constant and tier_weight is
    // NULL, so these four keys are the whole order in both paths. If they ever
    // disagree, the same city page returns two different orders depending on
    // which surface asked.
    const orderCalls = [...src.matchAll(/\.order\('([a-z_]+)'/g)].map((m) => m[1] ?? '')
    expect(orderCalls).toEqual(['is_featured', 'activity_score', 'save_count', 'published_at'])
    expect(src).not.toContain("order('ownership_label'")
  })
})
