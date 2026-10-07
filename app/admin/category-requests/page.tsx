import Link from 'next/link'
import type { Metadata } from 'next'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge'
import {
  CategoryRequestActions,
  type CategoryOption,
} from '@/components/admin/CategoryRequestActions'

export const metadata: Metadata = { title: 'Category requests' }

// Where "suggest a new category" on /add-business lands (ticket 126). The page
// already sits in the closest group; the team adds the category, moves the page
// to one that fits, or declines. The owner is emailed either way. The sidebar
// pill counts `pending`.

type RequestStatus = 'pending' | 'approved' | 'declined'

const STATUS_TABS: { value: RequestStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'declined', label: 'Declined' },
]

function isStatus(value: string): value is RequestStatus {
  return value === 'pending' || value === 'approved' || value === 'declined'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>
}

export default async function AdminCategoryRequestsPage({ searchParams }: PageProps) {
  await requireAdmin()
  const { status: rawStatus = 'pending', page = '1' } = await searchParams
  const status: RequestStatus = isStatus(rawStatus) ? rawStatus : 'pending'

  const pageNum = Math.max(1, parseInt(page) || 1)
  const limit = 25
  const offset = (pageNum - 1) * limit

  const serviceClient = createServiceClient()

  const [{ data: requests, count }, { data: categoryRows }] = await Promise.all([
    serviceClient
      .from('category_requests')
      .select(
        'id, listing_id, owner_words, proposed_name, parent_category_id, status, created_category_id, reviewed_at, created_at',
        { count: 'exact' }
      )
      .eq('status', status)
      .order('created_at', { ascending: status === 'pending' })
      .range(offset, offset + limit - 1),
    serviceClient
      .from('categories')
      .select('id, name, parent_id')
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ])

  const rows = requests ?? []
  const totalPages = Math.ceil((count ?? 0) / limit)

  const categories = categoryRows ?? []
  const categoryName = new Map(categories.map((c) => [c.id, c.name]))
  const options: CategoryOption[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    groupId: c.parent_id,
  }))

  const listingIds = [...new Set(rows.map((r) => r.listing_id))]
  const { data: listingRows } = listingIds.length
    ? await serviceClient
        .from('listings')
        .select('id, name, category_id, deleted_at')
        .in('id', listingIds)
    : { data: [] }
  const listings = new Map((listingRows ?? []).map((l) => [l.id, l]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Category requests</h1>
        <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
          New categories owners asked for when nothing fit. Oldest first. Every decision emails the
          owner.
        </p>
      </div>

      <div className="flex gap-1 border-b border-charcoal/10">
        {STATUS_TABS.map(({ value, label }) => (
          <Link
            key={value}
            href={`/admin/category-requests?status=${value}`}
            aria-current={status === value ? 'page' : undefined}
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

      {rows.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
          <p className="font-subhead text-sm text-charcoal-soft">
            {status === 'pending'
              ? 'No requests waiting. When an owner suggests a new category on Get Listed, it lands here.'
              : `No ${status} requests.`}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => {
            const listing = listings.get(r.listing_id)
            const currentId = listing?.category_id ?? null
            const current = currentId ? categoryName.get(currentId) : null
            const savedUnder = r.parent_category_id ? categoryName.get(r.parent_category_id) : null
            const endedIn = r.created_category_id ? categoryName.get(r.created_category_id) : null
            return (
              <li
                key={r.id}
                className="flex flex-col gap-4 rounded-xl border border-charcoal/10 bg-white px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-headline text-base text-brand-black">{r.proposed_name}</p>
                    <AdminStatusBadge status={r.status} />
                  </div>
                  <p className="mt-2 max-w-xl whitespace-pre-wrap font-body text-sm text-charcoal">
                    &ldquo;{r.owner_words}&rdquo;
                  </p>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-body text-xs">
                    <dt className="text-charcoal-soft">Business</dt>
                    <dd className="min-w-0 text-brand-black">
                      {listing && !listing.deleted_at ? (
                        <Link
                          href={`/admin/entities/${listing.id}`}
                          className="underline decoration-amber-gold underline-offset-2 hover:text-amber"
                        >
                          {listing.name}
                        </Link>
                      ) : (
                        'Deleted page'
                      )}
                    </dd>
                    <dt className="text-charcoal-soft">Saved under</dt>
                    <dd className="text-brand-black">{savedUnder ?? 'No category'}</dd>
                    {currentId !== r.parent_category_id && (
                      <>
                        <dt className="text-charcoal-soft">In now</dt>
                        <dd className="text-brand-black">{current ?? 'No category'}</dd>
                      </>
                    )}
                    {status === 'approved' && (
                      <>
                        <dt className="text-charcoal-soft">Moved to</dt>
                        <dd className="text-brand-black">{endedIn ?? 'Category removed'}</dd>
                      </>
                    )}
                    <dt className="text-charcoal-soft">
                      {status === 'pending' ? 'Asked' : 'Reviewed'}
                    </dt>
                    <dd className="text-brand-black tabular-nums">
                      {formatDate(
                        status === 'pending' ? r.created_at : (r.reviewed_at ?? r.created_at)
                      )}
                    </dd>
                  </dl>
                </div>

                {status === 'pending' && listing && !listing.deleted_at && (
                  <CategoryRequestActions
                    requestId={r.id}
                    proposedName={r.proposed_name}
                    currentCategoryId={currentId}
                    categories={options}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="font-body text-xs text-charcoal-soft">
            Page {pageNum} of {totalPages} · {count} total
          </p>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <Link
                href={`/admin/category-requests?status=${status}&page=${pageNum - 1}`}
                className="px-3 py-1.5 rounded-lg border border-charcoal/15 font-subhead text-xs font-semibold text-charcoal hover:bg-charcoal/5 transition-colors"
              >
                Previous
              </Link>
            )}
            {pageNum < totalPages && (
              <Link
                href={`/admin/category-requests?status=${status}&page=${pageNum + 1}`}
                className="px-3 py-1.5 rounded-lg border border-charcoal/15 font-subhead text-xs font-semibold text-charcoal hover:bg-charcoal/5 transition-colors"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
