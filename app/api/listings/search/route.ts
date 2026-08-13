import { NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/listings/search?q=<name>
 *
 * Name typeahead for signed-in users, backing the receipt-entry combobox.
 *
 * A consumer-facing sibling of /api/admin/listings-search, which is admin-gated
 * and 401s for everyone else. This one runs on the caller's own session rather
 * than the service role: "listings: authenticated read published or own"
 * (20260510000001_mvp_rls_policies.sql) already scopes a published-listing name
 * lookup correctly, so there is nothing here worth bypassing RLS for.
 */

const MIN_QUERY_LENGTH = 2
const RESULT_LIMIT = 10

export interface ListingSearchResult {
  id: string
  name: string
  slug: string
  cityName: string | null
}

type RawRow = {
  id: string
  name: string
  slug: string
  cities: { name: string } | null
}

/**
 * `%` and `_` are wildcards to ilike, so a user typing "50%" would otherwise
 * match far more than they asked for. PostgREST parameterizes the value, so
 * this is a correctness fix, not an injection fix.
 */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`)
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required.', code: 'AUTH_REQUIRED' },
      { status: 401 }
    )
  }

  const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ data: { listings: [] } })
  }

  const { data, error } = await supabase
    .from('listings')
    .select('id, name, slug, cities!listings_city_id_fkey(name)')
    .eq('status', 'published')
    .is('deleted_at', null)
    .ilike('name', `%${escapeLikePattern(q)}%`)
    .order('name')
    .limit(RESULT_LIMIT)

  if (error) {
    console.error('[listings/search] query failed:', {
      code: error.code,
      message: error.message,
      details: error.details,
    })
    return NextResponse.json(
      { error: 'Could not search listings.', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }

  // Flattened at the boundary: the PostgREST embed shape leaks awkwardly into
  // client types under noUncheckedIndexedAccess, and the caller only needs a
  // disambiguating city label.
  const listings: ListingSearchResult[] = ((data ?? []) as RawRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    cityName: row.cities?.name ?? null,
  }))

  return NextResponse.json({ data: { listings } })
}
