import Link from 'next/link'
import type { Metadata } from 'next'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge'

export const metadata: Metadata = { title: 'Claims' }

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  authorized_agent: 'Authorized Agent',
}

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>
}

export default async function AdminClaimsPage({ searchParams }: PageProps) {
  await requireAdmin()
  const { status = 'pending', page = '1' } = await searchParams

  const pageNum = Math.max(1, parseInt(page))
  const limit = 25
  const offset = (pageNum - 1) * limit

  const serviceClient = createServiceClient()

  const { data: claims, count } = await serviceClient
    .from('claims')
    .select(
      'id, status, role_at_business, verification_email, submitted_at, created_at, claimant_user_id, listing_id, listings!claims_listing_id_fkey(name, entity_type)',
      { count: 'exact' }
    )
    .eq('status', status)
    .order('submitted_at', { ascending: true })
    .range(offset, offset + limit - 1)

  const totalPages = Math.ceil((count ?? 0) / limit)

  // Fetch claimant display names for the visible page
  const claimantIds = (claims ?? [])
    .map((c) => c.claimant_user_id)
    .filter((id): id is string => id !== null)

  const profileMap: Record<string, string> = {}
  if (claimantIds.length > 0) {
    const { data: profiles } = await serviceClient
      .from('profiles')
      .select('id, display_name')
      .in('id', claimantIds)
    for (const p of profiles ?? []) {
      if (p.display_name) profileMap[p.id] = p.display_name
    }
  }

  const STATUS_TABS = [
    { value: 'pending', label: 'Pending' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'withdrawn', label: 'Withdrawn' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Claims</h1>
        <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
          Review and decide on business ownership claims.
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-charcoal/10">
        {STATUS_TABS.map(({ value, label }) => (
          <Link
            key={value}
            href={`/admin/claims?status=${value}`}
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
      {!claims || claims.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
          <p className="font-subhead text-sm text-charcoal-soft">
            No {status.replace(/_/g, ' ')} claims found.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          <table className="w-full text-sm" aria-label={`${status.replace(/_/g, ' ')} claims`}>
            <thead>
              <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                  Claimant
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden md:table-cell">
                  Business
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden lg:table-cell">
                  Role
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
              {claims.map((claim) => {
                const listing = claim.listings as { name: string; entity_type: string } | null
                // Fall back to the claim's verification email when the
                // claimant never set a display name (Finding 8).
                const claimantName =
                  (claim.claimant_user_id ? profileMap[claim.claimant_user_id] : null) ??
                  claim.verification_email ??
                  'Unknown user'
                const dateStr = claim.submitted_at ?? claim.created_at
                return (
                  <tr key={claim.id} className="hover:bg-[#f9f9fb] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-subhead text-sm font-semibold text-brand-black">
                        {claimantName}
                      </p>
                      <p className="font-mono text-xs text-charcoal-faint mt-0.5">
                        {claim.claimant_user_id?.slice(0, 8)}…
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="font-subhead text-sm font-semibold text-brand-black">
                        {listing?.name ?? '—'}
                      </p>
                      {listing?.entity_type && (
                        <p className="font-body text-xs text-charcoal-soft capitalize mt-0.5">
                          {listing.entity_type.replace(/_/g, ' ')}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="font-body text-xs text-charcoal-soft">
                        {claim.role_at_business
                          ? (ROLE_LABELS[claim.role_at_business] ?? claim.role_at_business)
                          : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <AdminStatusBadge status={claim.status} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-body text-xs text-charcoal-soft">
                        {formatDate(dateStr)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/claims/${claim.id}`}
                        className="font-subhead text-xs font-semibold text-amber hover:text-light-gold"
                        aria-label={`Review claim from ${claimantName}${listing?.name ? ` for ${listing.name}` : ''}`}
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
                    href={`/admin/claims?status=${status}&page=${pageNum - 1}`}
                    className="px-3 py-1.5 rounded border border-charcoal/15 font-subhead text-xs text-brand-black hover:border-amber-gold/40"
                  >
                    ← Prev
                  </Link>
                )}
                {pageNum < totalPages && (
                  <Link
                    href={`/admin/claims?status=${status}&page=${pageNum + 1}`}
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
