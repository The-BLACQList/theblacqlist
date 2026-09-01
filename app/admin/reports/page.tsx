import { Fragment } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge'
import { QueueItemActions } from '@/components/admin/QueueItemActions'
import { ISSUE_LABELS, type CorrectionIssueType } from '@/lib/constants/corrections'

export const metadata: Metadata = { title: 'Reports & Corrections' }

// The queue-type-specific payload written by submitCorrectionAction. Read
// defensively: rows created before 20260828000000_moderation_queue_details.sql
// have `details` NULL, and flagged_listing rows carry a different shape.
interface CorrectionDetails {
  issue_types?: unknown
  notes?: unknown
}

function readCorrectionDetails(raw: unknown): { issues: string[]; notes: string | null } {
  const d = (raw ?? {}) as CorrectionDetails
  const issues = Array.isArray(d.issue_types)
    ? d.issue_types
        .filter((t): t is string => typeof t === 'string')
        .map((t) => ISSUE_LABELS[t as CorrectionIssueType] ?? t)
    : []
  return { issues, notes: typeof d.notes === 'string' && d.notes ? d.notes : null }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface PageProps {
  searchParams: Promise<{ status?: string; type?: string; page?: string }>
}

export default async function AdminReportsPage({ searchParams }: PageProps) {
  await requireAdmin()
  const { status = 'pending', type = 'all', page = '1' } = await searchParams

  const pageNum = Math.max(1, parseInt(page))
  const limit = 25
  const offset = (pageNum - 1) * limit

  const serviceClient = createServiceClient()

  let query = serviceClient
    .from('moderation_queue')
    .select(
      'id, queue_type, status, entity_id, entity_type, priority, created_at, details, submitted_by',
      { count: 'exact' }
    )
    .in('queue_type', ['correction', 'flagged_listing'])
    .eq('status', status)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)

  if (type !== 'all') {
    query = query.eq('queue_type', type)
  }

  const { data: items, count } = await query
  const totalPages = Math.ceil((count ?? 0) / limit)

  // Join listing names for each queue item
  const entityIds = (items ?? []).map((i) => i.entity_id)
  const listingMap: Record<string, { name: string; slug: string }> = {}
  if (entityIds.length > 0) {
    const { data: listings } = await serviceClient
      .from('listings')
      .select('id, name, slug')
      .in('id', entityIds)
    for (const l of listings ?? []) {
      listingMap[l.id] = { name: l.name, slug: l.slug }
    }
  }

  const STATUS_TABS = [
    { value: 'pending', label: 'Pending' },
    { value: 'assigned', label: 'Assigned' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'dismissed', label: 'Dismissed' },
  ]

  const TYPE_TABS = [
    { value: 'all', label: 'All types' },
    { value: 'correction', label: 'Corrections' },
    { value: 'flagged_listing', label: 'Flagged listings' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Reports & corrections</h1>
        <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
          Handle user-submitted correction requests and flagged listings.
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-charcoal/10">
        {STATUS_TABS.map(({ value, label }) => (
          <Link
            key={value}
            href={`/admin/reports?status=${value}&type=${type}`}
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

      {/* Type filter */}
      <div className="flex gap-2">
        {TYPE_TABS.map(({ value, label }) => (
          <Link
            key={value}
            href={`/admin/reports?status=${status}&type=${value}`}
            className={`px-3 py-1 rounded-full border font-subhead text-xs font-semibold transition-colors ${
              type === value
                ? 'bg-brand-black text-white border-brand-black'
                : 'border-charcoal/15 text-charcoal-soft hover:border-charcoal/30 hover:text-brand-black'
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
            No {status} {type !== 'all' ? type.replace('_', ' ') : ''} reports found.
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
                  Type
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
              {items.map((item) => {
                const listing = listingMap[item.entity_id]
                const { issues, notes } = readCorrectionDetails(item.details)
                const hasReport = issues.length > 0 || notes !== null
                return (
                  <Fragment key={item.id}>
                  <tr className={`hover:bg-[#f9f9fb] transition-colors ${hasReport ? 'border-b-0' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-subhead text-sm font-semibold text-brand-black">
                        {listing?.name ?? 'Unknown listing'}
                      </p>
                      <p className="font-mono text-xs text-charcoal-faint mt-0.5">
                        {item.entity_id.slice(0, 8)}…
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-subhead text-xs text-charcoal-soft">
                        {item.queue_type === 'flagged_listing' ? 'Flagged listing' : 'Correction'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <AdminStatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="font-body text-xs text-charcoal-soft">
                        {formatDate(item.created_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {listing && (
                          <Link
                            href={`/admin/entities/${item.entity_id}`}
                            className="font-subhead text-xs font-semibold text-charcoal-soft hover:text-brand-black"
                          >
                            View listing
                          </Link>
                        )}
                        {status === 'pending' || status === 'assigned' ? (
                          <QueueItemActions queueId={item.id} revalidatePath="/admin/reports" />
                        ) : null}
                      </div>
                    </td>
                  </tr>

                  {/* What the reporter actually selected and wrote. Rendered as
                      its own row rather than inside the Listing cell because
                      notes run to 500 characters and would crush the column.
                      Absent for rows submitted before the details column
                      existed, and for flagged_listing rows. */}
                  {hasReport && (
                    <tr>
                      <td colSpan={5} className="px-4 pb-3 pt-0">
                        <div className="rounded-lg bg-[#f9f9fb] border border-charcoal/8 px-3 py-2.5">
                          {issues.length > 0 && (
                            <ul className="flex flex-wrap gap-1.5 mb-2">
                              {issues.map((label) => (
                                <li
                                  key={label}
                                  className="rounded-full border border-charcoal/15 px-2 py-0.5 font-subhead text-[11px] font-semibold text-charcoal"
                                >
                                  {label}
                                </li>
                              ))}
                            </ul>
                          )}
                          {notes && (
                            <p className="font-body text-sm text-charcoal whitespace-pre-wrap">
                              {notes}
                            </p>
                          )}
                          {/* By ID, never by name or email — see data-privacy.md. */}
                          <p className="font-mono text-[11px] text-charcoal-faint mt-2">
                            {item.submitted_by
                              ? `Reported by ${item.submitted_by.slice(0, 8)}…`
                              : 'Reported anonymously'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
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
                    href={`/admin/reports?status=${status}&type=${type}&page=${pageNum - 1}`}
                    className="px-3 py-1.5 rounded border border-charcoal/15 font-subhead text-xs text-brand-black hover:border-amber-gold/40"
                  >
                    ← Prev
                  </Link>
                )}
                {pageNum < totalPages && (
                  <Link
                    href={`/admin/reports?status=${status}&type=${type}&page=${pageNum + 1}`}
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
