import Link from 'next/link'
import type { Metadata } from 'next'

import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge'
import { ENTITY_TYPE_LABEL, LOCATION_TYPE_LABEL } from '@/components/discovery/facetConstants'
import {
  adminEntitiesHref,
  isSearchableAdminQuery,
  parseAdminEntityParams,
  type AdminEntityRawParams,
} from '@/lib/admin/entitySearch'
import { requireAdmin } from '@/lib/admin/guard'
import { escapeLikePattern } from '@/lib/db/like'
import { createServiceClient } from '@/lib/supabase/server'

import { EntityQueueControls } from './_components/EntityQueueControls'

export const metadata: Metadata = { title: 'Entities' }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface PageProps {
  searchParams: Promise<AdminEntityRawParams>
}

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
]

const PAGE_SIZE = 25

export default async function AdminEntitiesPage({ searchParams }: PageProps) {
  await requireAdmin()

  const params = parseAdminEntityParams(await searchParams)
  const { status, q, page: pageNum, entityType, locationType } = params
  const offset = (pageNum - 1) * PAGE_SIZE

  const serviceClient = createServiceClient()

  let query = serviceClient
    .from('listings')
    .select(
      'id, name, entity_type, location_type, status, trust_tier, created_at, tagline, categories(name)',
      { count: 'exact' }
    )
    // Was missing entirely: soft-deleted listings sat in the queue and inflated
    // every count on the page.
    .is('deleted_at', null)

  if (status !== 'all') query = query.eq('status', status)
  if (entityType) query = query.eq('entity_type', entityType)
  if (locationType) query = query.eq('location_type', locationType)

  if (isSearchableAdminQuery(q)) {
    // Server-side, not a filter over the visible 25 — the whole point is to find
    // a listing that is on page 7. At 257 published listings an ilike seq scan is
    // sub-millisecond, so no trigram index (that would be a migration for a
    // problem that does not exist).
    //
    // ⚠ Two escapes, both required. `sanitizeAdminQuery` has already removed the
    // `,()"` that would corrupt this comma-delimited .or() expression;
    // `escapeLikePattern` neutralises the `%` and `_` wildcards.
    const esc = escapeLikePattern(q)
    query = query.or(`name.ilike.%${esc}%,tagline.ilike.%${esc}%`)
  }

  const { data: listings, count } = await query
    .order('created_at', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1)

  const total = count ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const searching = isSearchableAdminQuery(q)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Entities</h1>
        <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
          Review and moderate submitted business listings.
        </p>
      </div>

      {/* Status tabs. `All` exposes draft / unpublished / flagged / archived,
          which had no route into this page at all before. */}
      <div className="flex gap-1 border-b border-charcoal/10">
        {STATUS_TABS.map(({ value, label }) => (
          <Link
            key={value}
            // Every href goes through the builder so `q` and the facets survive
            // a tab click. This is the thing that silently regresses.
            href={adminEntitiesHref(params, {
              status: value as typeof params.status,
              page: 1,
            })}
            className={`px-4 py-2 font-subhead text-sm font-semibold border-b-2 -mb-px transition-colors ${
              status === value
                ? 'border-amber-gold text-amber'
                : 'border-transparent text-charcoal-soft hover:text-brand-black'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <EntityQueueControls
        query={q}
        entityType={entityType ?? ''}
        locationType={locationType ?? ''}
        status={status}
      />

      <p aria-live="polite" className="font-body text-xs text-charcoal-soft">
        {total} {total === 1 ? 'listing' : 'listings'}
        {searching ? ` matching “${q}”` : ''}
      </p>

      {/* Table */}
      {!listings || listings.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
          <p className="font-subhead text-sm text-charcoal-soft">
            {searching
              ? `No listings match “${q}”${status === 'all' ? '' : ` in ${status}`}.`
              : `No ${status === 'all' ? '' : `${status} `}entities found.`}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                  Business name
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden md:table-cell">
                  Type
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden lg:table-cell">
                  Category
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden md:table-cell">
                  Submitted
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/5">
              {listings.map((listing) => {
                const category = listing.categories as { name: string } | null
                return (
                  <tr key={listing.id} className="hover:bg-[#f9f9fb] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-subhead text-sm font-semibold text-brand-black">
                        {listing.name}
                      </p>
                      {listing.tagline && (
                        <p className="font-body text-xs text-charcoal-soft line-clamp-1 mt-0.5">
                          {listing.tagline}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-body text-xs text-charcoal-soft">
                        {ENTITY_TYPE_LABEL[listing.entity_type] ??
                          listing.entity_type.replace(/_/g, ' ')}
                      </span>
                      {/* The review surface the location_type correction pass
                          depends on — it has to be visible to be corrected. */}
                      <span className="block font-body text-xs text-charcoal-soft/70 mt-0.5">
                        {listing.location_type
                          ? (LOCATION_TYPE_LABEL[listing.location_type] ?? listing.location_type)
                          : 'No location type'}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="font-body text-xs text-charcoal-soft">
                        {category?.name ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <AdminStatusBadge status={listing.status} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-body text-xs text-charcoal-soft">
                        {formatDate(listing.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/entities/${listing.id}`}
                        className="font-subhead text-xs font-semibold text-amber hover:text-light-gold"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-charcoal/10">
              <p className="font-body text-xs text-charcoal-soft">
                {total} total · page {pageNum} of {totalPages}
              </p>
              <div className="flex gap-2">
                {pageNum > 1 && (
                  <Link
                    href={adminEntitiesHref(params, { page: pageNum - 1 })}
                    className="px-3 py-1.5 rounded border border-charcoal/15 font-subhead text-xs text-brand-black hover:border-amber-gold/40"
                  >
                    ← Prev
                  </Link>
                )}
                {pageNum < totalPages && (
                  <Link
                    href={adminEntitiesHref(params, { page: pageNum + 1 })}
                    className="px-3 py-1.5 rounded border border-charcoal/15 font-subhead text-xs text-brand-black hover:border-amber-gold/40"
                  >
                    Next →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
