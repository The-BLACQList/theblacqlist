import Link from 'next/link'
import type { Metadata } from 'next'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { TOUR_STEPS, type TourStepKey } from '@/lib/tour/steps'
import { TOUR_STEP_COPY } from '@/lib/tour/verify'
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
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

// One row of tour_step_completions. `reflection` is NULL for the two un-gated
// progress steps and for a gated step the tester has not written yet.
interface CompletionRow {
  enrollment_id: string
  step_key: TourStepKey
  reflection: string | null
  reflected_at: string | null
}

// A reflection the founder can act on: text plus who and which step.
interface ReflectionEntry {
  enrollmentId: string
  step: TourStepKey
  text: string
  reflectedAt: string
}

type View = 'enrollments' | 'reflections'

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

const TAB_BASE =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold font-subhead transition-colors'
const TAB_ON = 'bg-brand-black text-white border-brand-black'
const TAB_OFF = 'bg-white text-charcoal-soft border-charcoal/15 hover:border-charcoal/40'

export default async function AdminTestersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  await requireAdmin()

  const params = await searchParams
  const view: View = params.view === 'reflections' ? 'reflections' : 'enrollments'

  const serviceClient = createServiceClient()

  const { data: enrollmentData } = await serviceClient
    .from('tour_enrollments')
    .select(
      'id, tester_user_id, listing_id, started_at, completed_at, trial_granted_at, ended_at, listings(name, slug)'
    )
    .order('started_at', { ascending: false })

  const enrollments = (enrollmentData ?? []) as EnrollmentRow[]

  // Progress and reflections come from the same rows. Tester scale, so one
  // query and no pagination. Reflections are what the founder actually reads:
  // the tour asks for twenty considered characters on four of the six steps,
  // and until this page showed them they only existed in the table.
  const stepCountMap: Record<string, number> = {}
  const reflectionsByEnrollment: Record<string, ReflectionEntry[]> = {}
  const allReflections: ReflectionEntry[] = []
  if (enrollments.length > 0) {
    const { data: steps } = await serviceClient
      .from('tour_step_completions')
      .select('enrollment_id, step_key, reflection, reflected_at')
      .in(
        'enrollment_id',
        enrollments.map((e) => e.id)
      )
    for (const s of (steps ?? []) as CompletionRow[]) {
      stepCountMap[s.enrollment_id] = (stepCountMap[s.enrollment_id] ?? 0) + 1
      if (s.reflection && s.reflected_at) {
        const entry: ReflectionEntry = {
          enrollmentId: s.enrollment_id,
          step: s.step_key,
          text: s.reflection,
          reflectedAt: s.reflected_at,
        }
        ;(reflectionsByEnrollment[s.enrollment_id] ??= []).push(entry)
        allReflections.push(entry)
      }
    }
    const newestFirst = (a: ReflectionEntry, b: ReflectionEntry) =>
      b.reflectedAt.localeCompare(a.reflectedAt)
    allReflections.sort(newestFirst)
    for (const list of Object.values(reflectionsByEnrollment)) list.sort(newestFirst)
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

  const enrollmentById = Object.fromEntries(enrollments.map((e) => [e.id, e]))
  const testerLabel = (enrollmentId: string) => {
    const e = enrollmentById[enrollmentId]
    if (!e) return enrollmentId.slice(0, 8)
    return emailMap[e.tester_user_id] ?? `${e.tester_user_id.slice(0, 8)}…`
  }

  const tourFlagOn = isFeatureEnabled('testerTour')
  const totalSteps = TOUR_STEPS.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Testers</h1>
        <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
          Tester Tour enrollments and what testers wrote at each step.
          Completing the tour unlocks a one-click 30-day Starter trial on the
          tester&rsquo;s own listing.
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

      <nav aria-label="Tester views" className="flex flex-wrap gap-2">
        <Link
          href="/admin/testers"
          aria-current={view === 'enrollments' ? 'page' : undefined}
          className={`${TAB_BASE} ${view === 'enrollments' ? TAB_ON : TAB_OFF}`}
        >
          Enrollments
          <span className="opacity-70">{enrollments.length}</span>
        </Link>
        <Link
          href="/admin/testers?view=reflections"
          aria-current={view === 'reflections' ? 'page' : undefined}
          className={`${TAB_BASE} ${view === 'reflections' ? TAB_ON : TAB_OFF}`}
        >
          Reflections
          <span className="opacity-70">{allReflections.length}</span>
        </Link>
      </nav>

      {view === 'reflections' ? (
        <ReflectionsList reflections={allReflections} testerLabel={testerLabel} />
      ) : enrollments.length === 0 ? (
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
                const reflections = reflectionsByEnrollment[row.id] ?? []
                return (
                  <EnrollmentRows
                    key={row.id}
                    row={row}
                    status={status}
                    done={done}
                    totalSteps={totalSteps}
                    tester={emailMap[row.tester_user_id] ?? `${row.tester_user_id.slice(0, 8)}…`}
                    reflections={reflections}
                  />
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// One enrollment: the summary row, then a second row holding every reflection
// the tester has written, newest first. Rendered inside the same <tbody> so
// the reflection sits directly under the person who wrote it.
function EnrollmentRows({
  row,
  status,
  done,
  totalSteps,
  tester,
  reflections,
}: {
  row: EnrollmentRow
  status: { label: string; className: string }
  done: number
  totalSteps: number
  tester: string
  reflections: ReflectionEntry[]
}) {
  return (
    <>
      <tr className="hover:bg-[#f9f9fb] transition-colors">
        <td className="px-4 py-3">
          <p className="font-subhead text-sm font-semibold text-brand-black">{tester}</p>
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
          <span className="block font-body text-xs text-charcoal-soft">
            {reflections.length === 0
              ? 'No reflections yet'
              : `${reflections.length} reflection${reflections.length === 1 ? '' : 's'}`}
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
          {row.ended_at === null && <EndEnrollmentButton enrollmentId={row.id} />}
        </td>
      </tr>
      {reflections.length > 0 && (
        <tr className="bg-[#fcfcfd]">
          <td colSpan={6} className="px-4 pb-4 pt-1">
            <ul className="space-y-3">
              {reflections.map((r) => (
                <ReflectionItem key={`${r.enrollmentId}-${r.step}`} entry={r} />
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  )
}

function ReflectionItem({ entry, tester }: { entry: ReflectionEntry; tester?: string }) {
  const copy = TOUR_STEP_COPY[entry.step]
  return (
    <li className="rounded-lg border border-charcoal/10 bg-white px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-subhead text-xs font-semibold text-brand-black">
          {tester && <span className="mr-2">{tester}</span>}
          <span className="text-charcoal-soft font-normal">{copy.title}</span>
        </p>
        <time
          dateTime={entry.reflectedAt}
          className="font-body text-xs text-charcoal-faint"
        >
          {formatDateTime(entry.reflectedAt)}
        </time>
      </div>
      {copy.prompt && (
        <p className="mt-1 font-body text-xs italic text-charcoal-soft">{copy.prompt}</p>
      )}
      <p className="mt-2 font-body text-sm text-brand-black whitespace-pre-wrap">{entry.text}</p>
    </li>
  )
}

// Every reflection from every tester, newest first. The triage view: read top
// to bottom once a day during the tester window.
function ReflectionsList({
  reflections,
  testerLabel,
}: {
  reflections: ReflectionEntry[]
  testerLabel: (enrollmentId: string) => string
}) {
  if (reflections.length === 0) {
    return (
      <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
        <p className="font-subhead text-sm text-charcoal-soft">
          No reflections yet. They appear here the moment a tester submits one
          on a reflection step of the tour.
        </p>
      </div>
    )
  }
  return (
    <ul className="space-y-3">
      {reflections.map((r) => (
        <ReflectionItem
          key={`${r.enrollmentId}-${r.step}`}
          entry={r}
          tester={testerLabel(r.enrollmentId)}
        />
      ))}
    </ul>
  )
}
