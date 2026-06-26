import Link from 'next/link'
import type { Metadata } from 'next'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge'

export const metadata: Metadata = { title: 'Verification' }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>
}

export default async function AdminVerificationPage({ searchParams }: PageProps) {
  await requireAdmin()
  const { status = 'pending', page = '1' } = await searchParams

  const pageNum = Math.max(1, parseInt(page))
  const limit = 25
  const offset = (pageNum - 1) * limit

  const serviceClient = createServiceClient()

  const { data: items, count } = await serviceClient
    .from('moderation_queue')
    .select('id, entity_id, status, priority, created_at', { count: 'exact' })
    .eq('queue_type', 'verification')
    .eq('status', status)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)

  const totalPages = Math.ceil((count ?? 0) / limit)

  // Join listing details for visible page
  const entityIds = (items ?? []).map((i) => i.entity_id)
  const listingMap: Record<
    string,
    { name: string; slug: string; trust_tier: string; verification_status: string | null }
  > = {}
  if (entityIds.length > 0) {
    const { data: listings } = await serviceClient
      .from('listings')
      .select('id, name, slug, trust_tier, verification_status')
      .in('id', entityIds)
    for (const l of listings ?? []) {
      listingMap[l.id] = {
        name: l.name,
        slug: l.slug,
        trust_tier: l.trust_tier,
        verification_status: l.verification_status,
      }
    }
  }

  const STATUS_TABS = [
    { value: 'pending', label: 'Pending' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'dismissed', label: 'Dismissed' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Verification</h1>
        <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
          Review and approve listing verification requests.
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-charcoal/10">
        {STATUS_TABS.map(({ value, label }) => (
          <Link
            key={value}
            href={`/admin/verification?status=${value}`}
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

      {/* Table */}
      {!items || items.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
          <p className="font-subhead text-sm text-charcoal-soft">
            No {status} verification requests.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                  Listing
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden md:table-cell">
                  Trust tier
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden lg:table-cell">
                  Verification
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden md:table-cell">
                  Requested
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/5">
              {items.map((item) => {
                const listing = listingMap[item.entity_id]
                return (
                  <tr key={item.id} className="hover:bg-[#f9f9fb] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-subhead text-sm font-semibold text-brand-black">
                        {listing?.name ?? 'Unknown listing'}
                      </p>
                      <p className="font-mono text-xs text-charcoal-faint mt-0.5">
                        {item.entity_id.slice(0, 8)}…
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {listing ? (
                        <AdminStatusBadge status={listing.trust_tier} />
                      ) : (
                        <span className="text-charcoal-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {listing?.verification_status ? (
                        <AdminStatusBadge status={listing.verification_status} />
                      ) : (
                        <span className="font-body text-xs text-charcoal-faint">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-body text-xs text-charcoal-soft">
                        {formatDate(item.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/verification/${item.entity_id}`}
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
                {count} total · page {pageNum} of {totalPages}
              </p>
              <div className="flex gap-2">
                {pageNum > 1 && (
                  <Link
                    href={`/admin/verification?status=${status}&page=${pageNum - 1}`}
                    className="px-3 py-1.5 rounded border border-charcoal/15 font-subhead text-xs text-brand-black hover:border-amber-gold/40"
                  >
                    ← Prev
                  </Link>
                )}
                {pageNum < totalPages && (
                  <Link
                    href={`/admin/verification?status=${status}&page=${pageNum + 1}`}
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
