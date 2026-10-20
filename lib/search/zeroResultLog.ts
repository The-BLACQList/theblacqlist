// Zero-result search log (ticket 142).
// Server only. Never import this in client components.
//
// [Decision — founder, 2026-10-20] Log only the searches that come back empty,
// anonymously, and keep them 90 days. The nightly purge lives in
// supabase/migrations/20261022000000_search_events_retention.sql, and the
// privacy review in docs/blacqlist/compliance/search-zero-result-log-review.md.
//
// A row keeps the trimmed words, the city, the category slug, result_count and
// the time. It NEVER keeps a user id, an IP, or coordinates: coordinates are
// precise enough to place a person at an address, so they stay out of this
// table no matter what the search was.

import { after } from 'next/server'

import { createServiceClient } from '@/lib/supabase/server'

export const MAX_LOGGED_QUERY_LENGTH = 200

const EMAIL_PATTERN = /\S+@\S+\.\S+/
// Seven or more digits in a row, allowing the separators people type in a
// phone number. A ZIP (5 digits) or a street number stays loggable.
const PHONE_PATTERN = /(?:\+?\d[\s().-]*){7,}/

/**
 * The form of a query that may be stored, or null when it must not be.
 *
 * Collapses whitespace and cuts to 200 characters. A query that looks like an
 * email address or a phone number is dropped whole rather than masked: someone
 * who typed their own contact details into the box did not mean to hand them to
 * us, and a masked row tells the team nothing anyway.
 */
export function loggableQuery(raw: string | null | undefined): string | null {
  const query = (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LOGGED_QUERY_LENGTH).trim()
  if (!query) return null
  if (EMAIL_PATTERN.test(query) || PHONE_PATTERN.test(query)) return null
  return query
}

export interface ZeroResultSearch {
  query: string | null | undefined
  resultCount: number
  page?: number
  /** Either the resolved id (the API path) or the URL slug (the page). */
  cityId?: string | null
  citySlug?: string | null
  categorySlug?: string | null
  /** True when a radius or deep filter could not run: that zero is an outage. */
  degraded?: boolean
}

/**
 * Whether this search belongs in the log: a real query, zero results, the
 * first page, and every filter actually ran.
 */
export function shouldLogZeroResult(search: ZeroResultSearch): boolean {
  return (
    search.resultCount === 0 &&
    (search.page ?? 1) === 1 &&
    !search.degraded &&
    loggableQuery(search.query) !== null
  )
}

/**
 * Records a zero-result search after the response is sent.
 *
 * Runs inside `after()` and awaits the insert, so the write is neither cut off
 * when the function ends nor allowed to slow the page. Failures are swallowed:
 * the log must never break search.
 */
export function logZeroResultSearch(search: ZeroResultSearch): void {
  if (!shouldLogZeroResult(search)) return
  const query = loggableQuery(search.query)
  if (!query) return

  after(async () => {
    try {
      const supabase = createServiceClient()

      let cityId = search.cityId ?? null
      if (!cityId && search.citySlug) {
        const { data } = await supabase
          .from('cities')
          .select('id')
          .eq('slug', search.citySlug)
          .maybeSingle()
        cityId = data?.id ?? null
      }

      await supabase.from('search_events').insert({
        query,
        result_count: 0,
        city_id: cityId,
        filters: search.categorySlug ? { category: search.categorySlug } : {},
      })
    } catch {
      // best-effort: a lost row is better than a broken search
    }
  })
}
