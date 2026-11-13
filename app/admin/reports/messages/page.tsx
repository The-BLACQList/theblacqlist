import Link from 'next/link'
import type { Metadata } from 'next'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge'
import { QueueItemActions } from '@/components/admin/QueueItemActions'
import { MessagingSuspensionActions } from '@/components/admin/MessagingSuspensionActions'
import { REPORT_REASON_LABELS, type ReportReason } from '@/lib/messaging/constants'
import { formatMessageTime } from '@/lib/messaging/format'
import { isUuid } from '@/lib/messaging/rules'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Message reports' }

const PATH = '/admin/reports/messages'
const PAGE_SIZE = 25
/** Messages shown before and after the reported one. */
const CONTEXT_BEFORE = 3
const CONTEXT_AFTER = 2

const STATUS_TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
] as const

interface ReportDetails {
  conversationId: string | null
  messageId: string | null
  listingId: string | null
  reportedUserId: string | null
  reporterRole: string | null
  reason: string | null
  note: string | null
}

function readDetails(raw: unknown): ReportDetails {
  const d = (raw ?? {}) as Record<string, unknown>
  const id = (v: unknown) => (isUuid(v) ? v : null)
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
  return {
    conversationId: id(d.conversation_id),
    messageId: id(d.message_id),
    listingId: id(d.listing_id),
    reportedUserId: id(d.reported_user_id),
    reporterRole: str(d.reporter_role),
    reason: str(d.reason),
    note: str(d.note),
  }
}

type ContextMessage = { id: string; sender_user_id: string | null; body: string; created_at: string }

/**
 * The reported message with a few either side, or the latest few when the
 * report is about the person. Admin-only, via the service client.
 */
async function loadContext(
  service: ReturnType<typeof createServiceClient>,
  conversationId: string,
  messageId: string | null
): Promise<ContextMessage[]> {
  const cols = 'id, sender_user_id, body, created_at'
  if (messageId) {
    const { data: target } = await service
      .from('messages')
      .select(cols)
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .maybeSingle()
    if (target) {
      const [before, after] = await Promise.all([
        service
          .from('messages')
          .select(cols)
          .eq('conversation_id', conversationId)
          .lt('created_at', target.created_at)
          .order('created_at', { ascending: false })
          .limit(CONTEXT_BEFORE),
        service
          .from('messages')
          .select(cols)
          .eq('conversation_id', conversationId)
          .gt('created_at', target.created_at)
          .order('created_at', { ascending: true })
          .limit(CONTEXT_AFTER),
      ])
      return [...(before.data ?? []).reverse(), target, ...(after.data ?? [])]
    }
  }
  const { data } = await service
    .from('messages')
    .select(cols)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(CONTEXT_BEFORE + CONTEXT_AFTER + 1)
  return (data ?? []).reverse()
}

/** By ID, never by name or email (data-privacy.md). */
function shortId(id: string | null) {
  return id ? `${id.slice(0, 8)}…` : 'unknown'
}

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>
}

export default async function AdminMessageReportsPage({ searchParams }: PageProps) {
  await requireAdmin()
  const params = await searchParams
  const status = STATUS_TABS.some((t) => t.value === params.status) ? params.status! : 'pending'
  const pageNum = Math.max(1, parseInt(params.page ?? '1') || 1)
  const offset = (pageNum - 1) * PAGE_SIZE

  const service = createServiceClient()
  const { data: items, count, error } = await service
    .from('moderation_queue')
    .select('id, status, priority, created_at, details, submitted_by', { count: 'exact' })
    .eq('queue_type', 'message_report')
    .eq('status', status)
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1)
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  const reports = (items ?? []).map((item) => ({ ...item, d: readDetails(item.details) }))
  const listingIds = [...new Set(reports.map((r) => r.d.listingId).filter((v): v is string => !!v))]
  const reportedIds = [...new Set(reports.map((r) => r.d.reportedUserId).filter((v): v is string => !!v))]

  const [listingsRes, suspensionsRes, contexts] = await Promise.all([
    listingIds.length
      ? service.from('listings').select('id, name').in('id', listingIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    reportedIds.length
      ? service.from('messaging_suspensions').select('user_id').in('user_id', reportedIds)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
    Promise.all(
      reports.map((r) => (r.d.conversationId ? loadContext(service, r.d.conversationId, r.d.messageId) : []))
    ),
  ])
  const listingNames = new Map((listingsRes.data ?? []).map((l) => [l.id, l.name]))
  const suspended = new Set((suspensionsRes.data ?? []).map((s) => s.user_id))

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/reports" className="font-subhead text-xs font-semibold text-charcoal-soft hover:text-brand-black">
          ← Reports &amp; corrections
        </Link>
        <h1 className="font-headline text-2xl text-brand-black mt-1">Message reports</h1>
        <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
          Reports from customers and business owners about in-app messages.
        </p>
      </div>

      <div className="flex gap-1 border-b border-charcoal/10">
        {STATUS_TABS.map(({ value, label }) => (
          <Link
            key={value}
            href={`${PATH}?status=${value}`}
            className={cn(
              'px-4 py-2 font-subhead text-sm font-semibold border-b-2 -mb-px transition-colors',
              status === value
                ? 'border-amber-gold text-amber'
                : 'border-transparent text-charcoal-soft hover:text-brand-black'
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-charcoal/10 bg-white px-6 py-4 font-body text-sm text-red-700">
          Couldn&apos;t load reports. Refresh to try again.
        </p>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
          <p className="font-subhead text-sm text-charcoal-soft">No {status} message reports.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {reports.map((r, i) => {
            const { d } = r
            const isSuspended = d.reportedUserId ? suspended.has(d.reportedUserId) : false
            const open = r.status === 'pending' || r.status === 'assigned'
            const context = contexts[i] ?? []
            return (
              <li key={r.id} className="rounded-xl border border-charcoal/10 bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-charcoal/15 px-2 py-0.5 font-subhead text-[11px] font-semibold text-charcoal">
                        {d.reason ? (REPORT_REASON_LABELS[d.reason as ReportReason] ?? d.reason) : 'No reason'}
                      </span>
                      {r.priority >= 2 && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 font-subhead text-[11px] font-semibold text-red-700">
                          High priority
                        </span>
                      )}
                      <AdminStatusBadge status={r.status} />
                      {isSuspended && (
                        <span className="rounded-full bg-charcoal/8 px-2 py-0.5 font-subhead text-[11px] font-semibold text-charcoal">
                          Messaging suspended
                        </span>
                      )}
                    </div>
                    <p className="font-body text-xs text-charcoal-soft">
                      {d.messageId ? 'One message' : 'The person'} · about{' '}
                      {(d.listingId && listingNames.get(d.listingId)) ?? 'unknown business'} ·{' '}
                      {formatMessageTime(r.created_at)}
                    </p>
                    <p className="font-mono text-[11px] text-charcoal-faint">
                      Reporter {shortId(r.submitted_by)} ({d.reporterRole ?? 'unknown'}) → reported{' '}
                      {shortId(d.reportedUserId)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {open && <QueueItemActions queueId={r.id} revalidatePath={PATH} />}
                    {(open || isSuspended) && (
                      <MessagingSuspensionActions
                        queueId={r.id}
                        reportedUserId={d.reportedUserId}
                        suspended={isSuspended}
                      />
                    )}
                  </div>
                </div>

                {d.note && (
                  <p className="rounded-lg bg-[#f9f9fb] border border-charcoal/8 px-3 py-2 font-body text-sm text-charcoal whitespace-pre-wrap">
                    {d.note}
                  </p>
                )}

                {context.length > 0 && (
                  <ol className="space-y-1.5 rounded-lg border border-charcoal/8 px-3 py-2.5" aria-label="Conversation context">
                    {context.map((m) => {
                      const fromReported = m.sender_user_id === d.reportedUserId
                      const isTarget = m.id === d.messageId
                      return (
                        <li
                          key={m.id}
                          className={cn('rounded-md px-2 py-1.5', isTarget && 'bg-amber-50 ring-1 ring-amber-gold/40')}
                        >
                          <p className="font-mono text-[11px] text-charcoal-faint">
                            {fromReported ? 'Reported user' : 'Reporter'} · {formatMessageTime(m.created_at)}
                            {isTarget && ' · reported message'}
                          </p>
                          <p className="font-body text-sm text-brand-black whitespace-pre-wrap break-words">{m.body}</p>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="font-subhead text-xs text-charcoal-soft">
            Page {pageNum} of {totalPages}
          </p>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <Link
                href={`${PATH}?status=${status}&page=${pageNum - 1}`}
                className="px-3 py-1.5 rounded-lg border border-charcoal/15 font-subhead text-xs font-semibold text-charcoal-soft hover:text-brand-black"
              >
                Previous
              </Link>
            )}
            {pageNum < totalPages && (
              <Link
                href={`${PATH}?status=${status}&page=${pageNum + 1}`}
                className="px-3 py-1.5 rounded-lg border border-charcoal/15 font-subhead text-xs font-semibold text-charcoal-soft hover:text-brand-black"
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
