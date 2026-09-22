import Link from 'next/link'
import type { Metadata } from 'next'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge'
import { ProblemReportActions } from '@/components/admin/ProblemReportActions'
import {
  PROBLEM_REPORT_STATUSES,
  type ProblemReportStatus,
} from '@/lib/feedback/problem-report'

export const metadata: Metadata = { title: 'Feedback' }

// Where the Report a problem button lands (item 1 of the 2026-09-21 pre-invite
// list: "somewhere that is immediately actionable"). One status at a time,
// newest first, the whole report text inline so nothing needs a click to read,
// and the action row moves it along. The sidebar pill counts `new`.

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function isStatus(value: string): value is ProblemReportStatus {
  return (PROBLEM_REPORT_STATUSES as readonly string[]).includes(value)
}

const STATUS_TABS: { value: ProblemReportStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'triaged', label: 'Triaged' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'dismissed', label: 'Dismissed' },
]

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  supporter: 'Supporter',
  admin: 'Admin',
  super_admin: 'Admin',
}

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>
}

export default async function AdminFeedbackPage({ searchParams }: PageProps) {
  await requireAdmin()
  const { status: rawStatus = 'new', page = '1' } = await searchParams
  const status: ProblemReportStatus = isStatus(rawStatus) ? rawStatus : 'new'

  const pageNum = Math.max(1, parseInt(page))
  const limit = 25
  const offset = (pageNum - 1) * limit

  const serviceClient = createServiceClient()

  const { data: reports, count } = await serviceClient
    .from('problem_reports')
    .select('id, user_id, role, page_path, user_agent, body, status, pr_ref, created_at', {
      count: 'exact',
    })
    .eq('status', status)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  const totalPages = Math.ceil((count ?? 0) / limit)
  const rows = reports ?? []

  // Reporter identity for the founder's eyes: email from auth, resolved at
  // render time (the table stores only the id). Failures degrade to the id
  // prefix rather than breaking the page. Same approach as /admin/testers.
  const emailMap: Record<string, string> = {}
  const reporterIds = [...new Set(rows.map((r) => r.user_id).filter((id): id is string => !!id))]
  await Promise.all(
    reporterIds.map(async (id) => {
      try {
        const { data } = await serviceClient.auth.admin.getUserById(id)
        if (data.user?.email) emailMap[id] = data.user.email
      } catch {
        // leave the fallback
      }
    })
  )
  const reporterLabel = (userId: string | null) => {
    if (!userId) return 'Deleted account'
    return emailMap[userId] ?? `${userId.slice(0, 8)}…`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Feedback</h1>
        <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
          Problem reports sent from the Report a problem button. Newest first.
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 border-b border-charcoal/10">
        {STATUS_TABS.map(({ value, label }) => (
          <Link
            key={value}
            href={`/admin/feedback?status=${value}`}
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
            {status === 'new'
              ? 'No new reports. Anything a signed-in user sends from the Report a problem button lands here.'
              : `No ${status} reports.`}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                  Report
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden md:table-cell">
                  From
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden lg:table-cell">
                  Sent
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/5">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-[#f9f9fb] transition-colors align-top">
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-brand-black">{r.page_path}</span>
                      <AdminStatusBadge status={r.status} />
                      {r.pr_ref && (
                        <span className="font-mono text-xs text-charcoal-soft">{r.pr_ref}</span>
                      )}
                    </div>
                    <p className="mt-2 max-w-xl whitespace-pre-wrap font-body text-sm text-charcoal">
                      {r.body}
                    </p>
                    {r.user_agent && (
                      <p
                        className="mt-2 max-w-xl truncate font-mono text-[11px] text-charcoal-faint"
                        title={r.user_agent}
                      >
                        {r.user_agent}
                      </p>
                    )}
                    <p className="mt-2 font-body text-xs text-charcoal-soft md:hidden">
                      {reporterLabel(r.user_id)}
                      {r.role ? ` · ${ROLE_LABELS[r.role] ?? r.role}` : ''}
                      {` · ${formatDateTime(r.created_at)}`}
                    </p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="font-body text-xs text-charcoal">{reporterLabel(r.user_id)}</p>
                    {r.role && (
                      <p className="font-subhead text-xs text-charcoal-soft mt-0.5">
                        {ROLE_LABELS[r.role] ?? r.role}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="font-body text-xs text-charcoal-soft whitespace-nowrap">
                      {formatDateTime(r.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <ProblemReportActions
                        reportId={r.id}
                        status={isStatus(r.status) ? r.status : 'new'}
                        prRef={r.pr_ref}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="font-body text-xs text-charcoal-soft">
            Page {pageNum} of {totalPages} · {count} total
          </p>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <Link
                href={`/admin/feedback?status=${status}&page=${pageNum - 1}`}
                className="px-3 py-1.5 rounded-lg border border-charcoal/15 font-subhead text-xs font-semibold text-charcoal hover:bg-charcoal/5 transition-colors"
              >
                Previous
              </Link>
            )}
            {pageNum < totalPages && (
              <Link
                href={`/admin/feedback?status=${status}&page=${pageNum + 1}`}
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
