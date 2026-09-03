// lib/admin/entitySearch.ts — the URL contract for /admin/entities.
//
// The page itself is an async server component behind `requireAdmin()` and the
// service client, so vitest (node, no jsdom) cannot render it. Everything that
// can get the URL wrong was pulled out into a pure module for exactly that
// reason, and this file is the reason it was worth doing.
//
// The bug these tests exist to prevent is silent: a status tab or a Prev link
// that forgets to carry `q` drops the founder's search on the first click and
// nothing errors.

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  ADMIN_ENTITIES_PATH,
  ADMIN_ENTITY_STATUSES,
  MIN_ADMIN_QUERY_LENGTH,
  adminEntitiesHref,
  hasActiveAdminFilters,
  isSearchableAdminQuery,
  parseAdminEntityParams,
  sanitizeAdminQuery,
  type AdminEntityParams,
} from '@/lib/admin/entitySearch'
import { escapeLikePattern } from '@/lib/db/like'

const REPO_ROOT = path.resolve(__dirname, '..')
const read = (rel: string) => readFileSync(path.join(REPO_ROOT, rel), 'utf8')

describe('sanitizeAdminQuery', () => {
  it('keeps an ordinary search intact', () => {
    expect(sanitizeAdminQuery('Carter')).toBe('Carter')
    expect(sanitizeAdminQuery('  carter & co  ')).toBe('carter & co')
  })

  it('strips the characters that break a PostgREST .or() expression', () => {
    // `.or()` is a COMMA-DELIMITED string; `(` `)` group and `"` quotes. A
    // comma left in the value silently splits one filter into two.
    expect(sanitizeAdminQuery('a,b(c)')).toBe('a b c')
    expect(sanitizeAdminQuery('say "hello"')).toBe('say hello')
    expect(sanitizeAdminQuery(',,,')).toBe('')
  })

  it('leaves ilike wildcards alone — escapeLikePattern owns those', () => {
    // Two sanitisers, two problems. Conflating them is how one of them would
    // eventually get deleted as a duplicate.
    expect(sanitizeAdminQuery('50%')).toBe('50%')
    expect(sanitizeAdminQuery('a_b')).toBe('a_b')
    expect(escapeLikePattern(sanitizeAdminQuery('50%'))).toBe('50\\%')
    expect(escapeLikePattern(sanitizeAdminQuery('a_b'))).toBe('a\\_b')
  })

  it('composes safely: no comma survives to the .or() string', () => {
    const raw = 'carter, co (demo) 50%'
    const esc = escapeLikePattern(sanitizeAdminQuery(raw))
    const orExpr = `name.ilike.%${esc}%,tagline.ilike.%${esc}%`
    // Exactly one comma — the one separating the two filters.
    expect(orExpr.split(',')).toHaveLength(2)
    expect(orExpr).not.toContain('(')
    expect(orExpr).not.toContain(')')
  })

  it('handles missing input without throwing', () => {
    expect(sanitizeAdminQuery(undefined)).toBe('')
    expect(sanitizeAdminQuery(null)).toBe('')
    expect(sanitizeAdminQuery('')).toBe('')
  })

  it('caps length and never leaves trailing whitespace from the cut', () => {
    const long = `${'a'.repeat(99)} tail`
    const out = sanitizeAdminQuery(long)
    expect(out.length).toBeLessThanOrEqual(100)
    expect(out).toBe(out.trim())
  })
})

describe('isSearchableAdminQuery', () => {
  it('rejects one character and accepts two', () => {
    // One character is noise, not a search — the same floor as the public
    // typeahead (components/spend/ListingCombobox.tsx:47).
    expect(MIN_ADMIN_QUERY_LENGTH).toBe(2)
    expect(isSearchableAdminQuery('')).toBe(false)
    expect(isSearchableAdminQuery('a')).toBe(false)
    expect(isSearchableAdminQuery('ab')).toBe(true)
  })
})

describe('parseAdminEntityParams', () => {
  it('defaults to the pending queue when nothing is asked for', () => {
    expect(parseAdminEntityParams({})).toEqual({
      status: 'pending',
      q: '',
      page: 1,
      entityType: null,
      locationType: null,
    })
  })

  it('widens to all statuses when a search term arrives with no explicit status', () => {
    // The one product decision in the module: "find it quickly" is the ask, and
    // a search that hides the answer because the listing is archived is worse
    // than no search.
    expect(parseAdminEntityParams({ q: 'carter' }).status).toBe('all')
    // Not for a sub-minimum query — that is not a search yet.
    expect(parseAdminEntityParams({ q: 'c' }).status).toBe('pending')
  })

  it('never overrides a status the founder chose', () => {
    expect(parseAdminEntityParams({ q: 'carter', status: 'published' }).status).toBe('published')
    expect(parseAdminEntityParams({ q: 'carter', status: 'pending' }).status).toBe('pending')
  })

  it('accepts every live status value', () => {
    for (const status of ADMIN_ENTITY_STATUSES) {
      expect(parseAdminEntityParams({ status }).status).toBe(status)
    }
    expect(parseAdminEntityParams({ status: 'all' }).status).toBe('all')
  })

  it('falls back rather than erroring on a hand-edited URL', () => {
    expect(parseAdminEntityParams({ status: 'nonsense' }).status).toBe('pending')
    expect(parseAdminEntityParams({ status: 'nonsense', q: 'carter' }).status).toBe('all')
  })

  it('clamps page to a positive integer', () => {
    expect(parseAdminEntityParams({ page: '3' }).page).toBe(3)
    expect(parseAdminEntityParams({ page: '0' }).page).toBe(1)
    expect(parseAdminEntityParams({ page: '-4' }).page).toBe(1)
    expect(parseAdminEntityParams({ page: 'abc' }).page).toBe(1)
    expect(parseAdminEntityParams({ page: '' }).page).toBe(1)
  })

  it('accepts only real entity and location types', () => {
    expect(parseAdminEntityParams({ type: 'restaurant' }).entityType).toBe('restaurant')
    expect(parseAdminEntityParams({ type: 'not_a_type' }).entityType).toBeNull()
    expect(parseAdminEntityParams({ location_type: 'virtual' }).locationType).toBe('virtual')
    expect(parseAdminEntityParams({ location_type: 'nowhere' }).locationType).toBeNull()
  })

  it('sanitises q at the boundary, so the page never sees a raw query', () => {
    expect(parseAdminEntityParams({ q: 'a,b(c)' }).q).toBe('a b c')
  })
})

describe('adminEntitiesHref', () => {
  const base: AdminEntityParams = {
    status: 'all',
    q: 'carter',
    page: 3,
    entityType: 'restaurant',
    locationType: 'virtual',
  }

  it('carries the search across a status tab click', () => {
    // ⚠ THE regression. Every tab href on the page goes through this builder
    // precisely so a tab click cannot drop `q`.
    const href = adminEntitiesHref(base, { status: 'published', page: 1 })
    const params = new URLSearchParams(href.split('?')[1])
    expect(params.get('q')).toBe('carter')
    expect(params.get('status')).toBe('published')
    expect(params.get('page')).toBeNull()
    expect(params.get('type')).toBe('restaurant')
    expect(params.get('location_type')).toBe('virtual')
  })

  it('carries the search across a page click', () => {
    const href = adminEntitiesHref(base, { page: 4 })
    const params = new URLSearchParams(href.split('?')[1])
    expect(params.get('q')).toBe('carter')
    expect(params.get('page')).toBe('4')
    expect(params.get('status')).toBe('all')
  })

  it('round-trips through parse for every status and page', () => {
    for (const status of [...ADMIN_ENTITY_STATUSES, 'all'] as const) {
      for (const page of [1, 2, 17]) {
        const href = adminEntitiesHref(base, { status, page })
        const raw = Object.fromEntries(new URLSearchParams(href.split('?')[1]))
        expect(parseAdminEntityParams(raw)).toEqual({ ...base, status, page })
      }
    }
  })

  it('always emits status, even when it equals the default', () => {
    // Omitting it would make the href depend on defaultStatus(), so `?q=carter`
    // would silently re-derive `all` — correct today, a trap the first time
    // that default changes.
    const href = adminEntitiesHref({ ...base, status: 'pending', q: '' })
    expect(href).toContain('status=pending')
  })

  it('omits empty filters rather than emitting blanks', () => {
    const href = adminEntitiesHref({
      status: 'pending',
      q: '',
      page: 1,
      entityType: null,
      locationType: null,
    })
    expect(href).toBe(`${ADMIN_ENTITIES_PATH}?status=pending`)
  })

  it('encodes a query that would otherwise break the URL', () => {
    const href = adminEntitiesHref({ ...base, q: 'soul food & co' })
    expect(href).not.toContain(' ')
    const params = new URLSearchParams(href.split('?')[1])
    expect(params.get('q')).toBe('soul food & co')
  })

  it('stays on /admin/entities', () => {
    expect(adminEntitiesHref(base).startsWith(`${ADMIN_ENTITIES_PATH}?`)).toBe(true)
  })
})

describe('hasActiveAdminFilters', () => {
  const empty: AdminEntityParams = {
    status: 'pending',
    q: '',
    page: 1,
    entityType: null,
    locationType: null,
  }

  it('is false for the untouched queue and true for each filter', () => {
    expect(hasActiveAdminFilters(empty)).toBe(false)
    expect(hasActiveAdminFilters({ ...empty, q: 'carter' })).toBe(true)
    expect(hasActiveAdminFilters({ ...empty, entityType: 'restaurant' })).toBe(true)
    expect(hasActiveAdminFilters({ ...empty, locationType: 'virtual' })).toBe(true)
  })

  it('ignores page, which is not a filter', () => {
    expect(hasActiveAdminFilters({ ...empty, page: 5 })).toBe(false)
  })
})

describe('the admin queue page wiring', () => {
  // Source-text, because the page is an async server component vitest cannot
  // render. These assert the three things that would regress invisibly.
  const page = read('app/admin/entities/page.tsx')

  it('builds every href through adminEntitiesHref', () => {
    expect(page).toContain('adminEntitiesHref')
    // The literal template hrefs that used to drop `q` on every click.
    expect(page).not.toMatch(/href=\{`\/admin\/entities\?status=/)
  })

  it('excludes soft-deleted listings from the queue and its counts', () => {
    expect(page).toContain(".is('deleted_at', null)")
  })

  it('filters on status only when a status is actually selected', () => {
    expect(page).toContain("if (status !== 'all') query = query.eq('status', status)")
  })

  it('escapes the query before it reaches the .or() expression', () => {
    expect(page).toContain('escapeLikePattern(q)')
    expect(page).toContain('name.ilike.%${esc}%,tagline.ilike.%${esc}%')
  })

  it('surfaces location_type, the review surface the correction pass needs', () => {
    expect(page).toContain('LOCATION_TYPE_LABEL')
    expect(page).toContain('location_type')
  })
})

describe('escapeLikePattern has one home', () => {
  it('is imported, not re-declared, by both consumers', () => {
    // Copying it a third time is precisely how location_type ended up with
    // three drifting definitions.
    const searchRoute = read('app/api/listings/search/route.ts')
    const page = read('app/admin/entities/page.tsx')
    for (const [name, src] of [
      ['search route', searchRoute],
      ['admin entities page', page],
    ] as const) {
      expect(src, name).toContain("from '@/lib/db/like'")
      expect(src, name).not.toMatch(/function escapeLikePattern/)
    }
  })
})
