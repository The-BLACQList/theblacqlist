import Link from 'next/link'
import type { Metadata } from 'next'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { TOUR_STEPS } from '@/lib/tour/steps'
import {
  InviteTesterForm,
  EndEnrollmentButton,
} from '@/components/admin/TesterTourActions'

export const metadata: Metadata = { title: 'Testers' }

// The enrollment list must reflect an invite or an end immediately.
export const dynamic = 'force-dynamic'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

interface EnrollmentRow {
  id: string
  tester_user_id: string
  listing_id: string
  started_at: string
  completed_at: string | null
  trial_granted_at: string | null
  ended_at: string | null
  listings: { name: string; slug: string } | null
}

function enrollmentStatus(row: EnrollmentRow): { label: string; className: string } {
  if (row.ended_at) {
    return { label: 'Ended', className: 'bg-charcoal/10 text-charcoal-soft border-charcoal/15' }
  }
  if (row.trial_granted_at) {
    return { label: 'Trial claimed', className: 'bg-green-50 text-green-800 border-green-200' }
  }
  if (row.completed_at) {
    return { label: 'Completed', className: 'bg-amber-gold/10 text-amber-800 border-amber-200' }
  }
  return { label: 'In progress', className: 'bg-blue-50 text-blue-800 border-blue-200' }
}

export default async function AdminTestersPage() {
  await requireAdmin()

  const serviceClient = createServiceClient()

  const { data: enrollmentData } = await serviceClient
    .from('tour_enrollments')
    .select(
      'id, tester_user_id, listing_id, started_at, completed_at, trial_granted_at, ended_at, listings(name, slug)'
    )
    .order('started_at', { ascending: false })

  const enrollments = (enrollmentData ?? []) as EnrollmentRow[]

  // Progress: completions per enrollment. Tester scale — no pagination needed.
  const stepCountMap: Record<string, number> = {}
  if (enrollments.length > 0) {
    const { data: steps } = await serviceClient
      .from('tour_step_completions')
      .select('enrollment_id')
      .in(
        'enrollment_id',
        enrollments.map((e) => e.id)
      )
    for (const s of steps ?? []) {
      stepCountMap[s.enrollment_id] = (stepCountMap[s.enrollment_id] ?? 0) + 1
    }
  }

  // Tester identity for the founder's eyes: email from auth. Failures degrade
  // to the id prefix rather than breaking the page.
  const emailMap: Record<string, string> = {}
  const testerIds = [...new Set(enrollments.map((e) => e.tester_user_id))]
  await Promise.all(
    testerIds.map(async (id) => {
      try {
        const { data } = await serviceClient.auth.admin.getUserById(id)
        if (data.user?.email) emailMap[id] = data.user.email
      } catch {
        // leave the fallback
      }
    })
  )

  const tourFlagOn = isFeatureEnabled('testerTour')
  const totalSteps = TOUR_STEPS.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Testers</h1>
        <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
          Tester Tour enrollments. Completing the tour unlocks a one-click
          30-day Starter trial on the tester&rsquo;s own listing.
        </p>
      </div>

      {!tourFlagOn && (
        <div className="rounded-xl border border-amber-200 bg-amber-gold/10 px-4 py-3">
          <p className="font-subhead text-sm text-amber-800">
            The tester tour flag is <strong>off</strong> in this environment
            (FEATURE_TESTER_TOUR). Enrollments can be managed here, but testers
            will not see the tour rail until the flag is on.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-charcoal/10 bg-white p-5">
        <h2 className="font-subhead text-sm font-bold text-brand-black uppercase tracking-wide">
          Invite a tester
        </h2>
        <div className="mt-3">
          <InviteTesterForm />
        </div>
      </div>

      {enrollments.length === 0 ? (
        <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
          <p className="font-subhead text-sm text-charcoal-soft">
            No enrollments yet. Invite a listing owner above to start their
            tour.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-charcoal/10 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                  Tester
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                  Listing
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                  Progress
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden lg:table-cell">
                  Started
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/5">
              {enrollments.map((row) => {
                const status = enrollmentStatus(row)
                const done = stepCountMap[row.id] ?? 0
                return (
                  <tr key={row.id} className="hover:bg-[#f9f9fb] transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-subhead text-sm font-semibold text-brand-black">
                        {emailMap[row.tester_user_id] ??
                          `${row.tester_user_id.slice(0, 8)}…`}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {row.listings ? (
                        <Link
                          href={`/admin/entities/${row.listing_id}`}
                          className="font-subhead text-sm text-brand-black underline decoration-charcoal/30 underline-offset-2 hover:decoration-amber-gold"
                        >
                          {row.listings.name}
                        </Link>
                      ) : (
                        <span className="font-body text-xs text-charcoal-faint">
                          {row.listing_id.slice(0, 8)}…
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-subhead text-sm text-brand-black">
                        {done}/{totalSteps}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold font-subhead ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="font-body text-xs text-charcoal-soft">
                        {formatDate(row.started_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.ended_at === null && (
                        <EndEnrollmentButton enrollmentId={row.id} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
