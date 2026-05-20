import Link from 'next/link'
import type { Metadata } from 'next'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import { AdminStatCard } from '@/components/admin/AdminStatCard'
import { AdminStatusBadge } from '@/components/admin/AdminStatusBadge'

export const metadata: Metadata = { title: 'Overview' }

function formatRelativeDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const QUEUE_TYPE_LABELS: Record<string, string> = {
  new_submission: 'New entity',
  claim_review: 'Claim',
  verification: 'Verification',
  correction: 'Correction',
  review: 'Review',
  flagged_listing: 'Flagged listing',
}

export default async function AdminOverviewPage() {
  const { user, role } = await requireAdmin()
  const serviceClient = createServiceClient()

  // Run stat queries in parallel
  const [
    { count: pendingEntities },
    { count: pendingClaims },
    { count: pendingVerifications },
    { count: pendingReports },
    { data: recentQueue },
  ] = await Promise.all([
    serviceClient
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    serviceClient
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'under_review']),
    serviceClient
      .from('moderation_queue')
      .select('id', { count: 'exact', head: true })
      .eq('queue_type', 'verification')
      .eq('status', 'pending'),
    serviceClient
      .from('moderation_queue')
      .select('id', { count: 'exact', head: true })
      .in('queue_type', ['correction', 'review', 'flagged_listing'])
      .eq('status', 'pending'),
    serviceClient
      .from('moderation_queue')
      .select('id, queue_type, entity_id, entity_type, created_at, status')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Overview</h1>
        <p className="font-subhead text-sm text-charcoal/60 mt-0.5">
          Signed in as {user.email} ·{' '}
          <span className="text-amber-gold">
            {role === 'super_admin' ? 'Super Admin' : 'Admin'}
          </span>
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          label="Pending entities"
          count={pendingEntities ?? 0}
          href="/admin/entities"
          urgent
        />
        <AdminStatCard
          label="Pending claims"
          count={pendingClaims ?? 0}
          href="/admin/claims"
          urgent
        />
        <AdminStatCard
          label="Pending verification"
          count={pendingVerifications ?? 0}
          href="/admin/verification"
        />
        <AdminStatCard label="Reports & flags" count={pendingReports ?? 0} href="/admin/reports" />
      </div>

      {/* Recent queue */}
      <div>
        <h2 className="font-headline text-lg text-brand-black mb-4">Recent queue activity</h2>
        {!recentQueue || recentQueue.length === 0 ? (
          <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-10 text-center">
            <p className="font-subhead text-sm text-charcoal/60">
              All clear — no pending items in the queue.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
                  <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">
                    Entity ID
                  </th>
                  <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal/60 uppercase tracking-wide">
                    Age
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-charcoal/5">
                {recentQueue.map((item) => {
                  const itemHref =
                    item.queue_type === 'new_submission'
                      ? `/admin/entities/${item.entity_id}`
                      : item.queue_type === 'claim_review'
                        ? `/admin/claims/${item.entity_id}`
                        : item.queue_type === 'verification'
                          ? `/admin/verification/${item.entity_id}`
                          : `/admin/reports`

                  return (
                    <tr key={item.id} className="hover:bg-[#f9f9fb] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-subhead text-xs font-semibold text-brand-black">
                          {QUEUE_TYPE_LABELS[item.queue_type] ?? item.queue_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-charcoal/60 max-w-[160px] truncate">
                        {item.entity_id}
                      </td>
                      <td className="px-4 py-3">
                        <AdminStatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 font-body text-xs text-charcoal/60">
                        <Link
                          href={itemHref}
                          className="text-amber-gold hover:text-light-gold font-subhead font-semibold"
                        >
                          {formatRelativeDate(item.created_at)} →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="font-headline text-lg text-brand-black mb-4">Quick actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { href: '/admin/entities', label: 'Review pending entities' },
            { href: '/admin/claims', label: 'Review pending claims' },
            { href: '/admin/verification', label: 'Verification queue' },
            { href: '/admin/reviews', label: 'Review moderation' },
            { href: '/admin/reports', label: 'Reports & corrections' },
            { href: '/admin/analytics', label: 'Platform analytics' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl border border-charcoal/10 bg-white px-4 py-3 font-subhead text-sm font-semibold text-brand-black hover:border-amber-gold/40 hover:text-amber-gold transition-colors"
            >
              {label} →
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
