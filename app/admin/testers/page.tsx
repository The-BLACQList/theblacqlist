import Link from 'next/link'
import type { Metadata } from 'next'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { REFLECTION_GATED_STEPS, TOUR_STEPS, type TourStepKey } from '@/lib/tour/steps'
import { TOUR_STEP_COPY } from '@/lib/tour/verify'
import { RevokeLinkButton } from '@/components/admin/TesterLinkCard'
import { TesterBoard } from '@/components/admin/TesterBoard'
import { TesterBoardHeader } from '@/components/admin/TesterBoardHeader'
import { testerLinkStatus, type TesterLinkStatus } from '@/lib/tester/links'
import { TESTER_CAP, formatTesterNumber } from '@/lib/tester/cap'
import {
  daysSince,
  endWarning,
  freeMonthText,
  isOwnerTester,
  lastActiveAt,
  spotStatus,
  walkStates,
  type BoardTester,
} from '@/lib/tester/board'

export const metadata: Metadata = { title: 'Testers' }

// The board must reflect an invite or an end immediately.
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

/** "Today", "Yesterday" or "5 days ago", then the date. */
function activeText(iso: string, now: Date) {
  const days = daysSince(iso, now)
  const ago = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`
  return `${ago}, ${formatDate(iso)}`
}

interface EnrollmentRow {
  id: string
  tester_user_id: string
  // "Tester 07": the ID testers see in their Tour panel and quote in feedback.
  tester_number: number
  // NULL is a supporter tester, or an owner with no page yet (is_owner), whose
  // free month goes on a page they own later.
  listing_id: string | null
  is_owner: boolean
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
  completed_at: string
  reflection: string | null
  reflected_at: string | null
}

// An answer the founder can act on: text plus who and which step.
interface ReflectionEntry {
  enrollmentId: string
  step: TourStepKey
  text: string
  reflectedAt: string
}

type View = 'spots' | 'answers'

// One-tap links, without the email: the table only needs the label to tell
// links apart, and leaving PII out of the page keeps it out of screenshots.
interface TesterLinkRow {
  id: string
  kind: string
  listing_id: string | null
  label: string
  use_count: number
  max_uses: number
  expires_at: string
  revoked_at: string | null
  created_at: string
}

const LINK_STATUS_CLASS: Record<TesterLinkStatus['state'], string> = {
  unused: 'bg-blue-50 text-blue-800 border-blue-200',
  in_use: 'bg-green-50 text-green-800 border-green-200',
  used_up: 'bg-charcoal/10 text-charcoal-soft border-charcoal/15',
  expired: 'bg-charcoal/10 text-charcoal-soft border-charcoal/15',
  revoked: 'bg-red-50 text-red-700 border-red-200',
}

const TAB_BASE =
  'inline-flex min-h-11 items-center gap-1.5 px-4 rounded-full border text-sm font-semibold font-subhead transition-colors'
const TAB_ON = 'bg-brand-black text-white border-brand-black'
const TAB_OFF = 'bg-white text-ink border-charcoal/15 hover:border-charcoal/40'
const MUTED = 'text-[#55545a]'

export default async function AdminTestersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; tester?: string }>
}) {
  await requireAdmin()

  const params = await searchParams
  // ?view=reflections was the old name for the answers view; old bookmarks still land there.
  const view: View =
    params.view === 'answers' || params.view === 'reflections' ? 'answers' : 'spots'
  const initialNumber = /^\d{1,3}$/.test(params.tester ?? '') ? Number(params.tester) : null

  const serviceClient = createServiceClient()

  const { data: enrollmentData } = await serviceClient
    .from('tour_enrollments')
    .select(
      'id, tester_user_id, tester_number, listing_id, is_owner, started_at, completed_at, trial_granted_at, ended_at, listings(name, slug)'
    )
    .order('started_at', { ascending: false })

  const enrollments = (enrollmentData ?? []) as EnrollmentRow[]
  // The cap counts live enrollments only: ending one frees its spot.
  const spotsTaken = enrollments.filter((e) => e.ended_at === null).length

  const { data: linkData } = await serviceClient
    .from('tester_invites')
    .select('id, kind, listing_id, label, use_count, max_uses, expires_at, revoked_at, created_at')
    .order('created_at', { ascending: false })

  const links = (linkData ?? []) as TesterLinkRow[]

  // Progress, last activity and answers all come from the same rows. Tester
  // scale, so one query and no pagination.
  const stepsByEnrollment: Record<string, CompletionRow[]> = {}
  const allReflections: ReflectionEntry[] = []
  if (enrollments.length > 0) {
    const { data: steps } = await serviceClient
      .from('tour_step_completions')
      .select('enrollment_id, step_key, completed_at, reflection, reflected_at')
      .in(
        'enrollment_id',
        enrollments.map((e) => e.id)
      )
    for (const s of (steps ?? []) as CompletionRow[]) {
      ;(stepsByEnrollment[s.enrollment_id] ??= []).push(s)
      if (s.reflection && s.reflected_at) {
        allReflections.push({
          enrollmentId: s.enrollment_id,
          step: s.step_key,
          text: s.reflection,
          reflectedAt: s.reflected_at,
        })
      }
    }
    allReflections.sort((a, b) => b.reflectedAt.localeCompare(a.reflectedAt))
  }

  // Tester identity for the founder's eyes: email from auth. A failed lookup
  // shows "Email not available" rather than breaking the page.
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

  const now = new Date()
  const testers: BoardTester[] = enrollments.map((e) =>
    buildTester(e, stepsByEnrollment[e.id] ?? [], emailMap, now)
  )
  const numberById = Object.fromEntries(enrollments.map((e) => [e.id, e.tester_number]))

  const tourFlagOn = isFeatureEnabled('testerTour')

  return (
    <div className="space-y-6">
      <TesterBoardHeader taken={spotsTaken} cap={TESTER_CAP} />

      {!tourFlagOn && (
        <div className="rounded-xl border border-amber-200 bg-amber-gold/10 px-4 py-3">
          <p className="font-subhead text-sm text-amber-800">
            The tester tour flag is <strong>off</strong> in this environment (FEATURE_TESTER_TOUR).
            Testers can be managed here, but they will not see the tour rail until the flag is on.
          </p>
        </div>
      )}

      <nav aria-label="Tester views" className="flex flex-wrap gap-2">
        <Link
          href="/admin/testers"
          aria-current={view === 'spots' ? 'page' : undefined}
          className={`${TAB_BASE} ${view === 'spots' ? TAB_ON : TAB_OFF}`}
        >
          Spots
        </Link>
        <Link
          href="/admin/testers?view=answers"
          aria-current={view === 'answers' ? 'page' : undefined}
          className={`${TAB_BASE} ${view === 'answers' ? TAB_ON : TAB_OFF}`}
        >
          All answers
          <span className="opacity-70">{allReflections.length}</span>
        </Link>
      </nav>

      {view === 'answers' ? (
        <AnswersByQuestion reflections={allReflections} numberById={numberById} />
      ) : (
        <TesterBoard
          testers={testers}
          cap={TESTER_CAP}
          initialNumber={initialNumber}
          links={<LinksStrip links={links} />}
        />
      )}
    </div>
  )
}

// Everything the board shows about one tester, worked out here so the client
// gets plain data: the tour copy stays on the server, and dates are formatted
// once so the browser's time zone can't disagree with the first render.
function buildTester(
  e: EnrollmentRow,
  steps: CompletionRow[],
  emailMap: Record<string, string>,
  now: Date
): BoardTester {
  const status = spotStatus(e, steps, now)
  const states = walkStates(steps, status)
  const byKey = new Map(steps.map((s) => [s.step_key, s]))
  return {
    id: e.id,
    number: e.tester_number,
    label: formatTesterNumber(e.tester_number),
    email: emailMap[e.tester_user_id] ?? null,
    owner: isOwnerTester(e),
    pageName: e.listing_id === null ? null : (e.listings?.name ?? 'Page not found'),
    pageHref: e.listing_id === null ? null : `/admin/entities/${e.listing_id}`,
    joinedText: formatDate(e.started_at),
    lastActiveText: activeText(lastActiveAt(e, steps), now),
    status,
    freeMonth: freeMonthText(e),
    endWarning: endWarning(e),
    endedText: e.ended_at ? formatDate(e.ended_at) : null,
    walk: TOUR_STEPS.map((key) => {
      const s = byKey.get(key)
      const copy = TOUR_STEP_COPY[key]
      const answered = s?.reflection && s.reflected_at ? s : null
      return {
        key,
        title: copy.title,
        state: states[key],
        prompt: answered ? copy.prompt : null,
        answer: answered?.reflection ?? null,
        answeredText: answered?.reflected_at ? formatDateTime(answered.reflected_at) : null,
      }
    }),
  }
}

// Links someone can still use, at a glance. The full history, with Revoke,
// sits behind "See all links".
const LINKS_SHOWN = 3

function LinksStrip({ links }: { links: TesterLinkRow[] }) {
  if (links.length === 0) return null
  const now = new Date()
  const live = links.filter((l) => {
    const state = testerLinkStatus(l, now).state
    return state === 'unused' || state === 'in_use'
  })
  return (
    <section aria-labelledby="links-heading" className="space-y-3">
      <h2
        id="links-heading"
        className="font-subhead text-xs font-bold uppercase tracking-wide text-ink"
      >
        Links that still work
      </h2>
      {live.length === 0 ? (
        <p className={`font-body text-sm ${MUTED}`}>
          None right now. Make a link to invite someone new.
        </p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {live.slice(0, LINKS_SHOWN).map((l) => (
            <li
              key={l.id}
              className="rounded-lg border border-charcoal/15 bg-white px-3 py-2 font-body text-sm text-ink"
            >
              <span className="font-subhead font-semibold">{l.label}</span>
              <span className={MUTED}>
                {' '}
                · {l.use_count} of {l.max_uses} used · until {formatDate(l.expires_at)}
              </span>
            </li>
          ))}
          {live.length > LINKS_SHOWN && (
            <li className={`self-center font-body text-sm ${MUTED}`}>
              and {live.length - LINKS_SHOWN} more in the full list
            </li>
          )}
        </ul>
      )}
      <details className="group">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-subhead text-sm font-semibold text-ink underline decoration-charcoal/30 underline-offset-2 hover:decoration-amber-gold">
          See all links ({links.length})
        </summary>
        <LinksTable links={links} />
      </details>
    </section>
  )
}

// Every link ever made, newest first. Live ones get a Revoke button; the rest
// stay listed so the founder can see what was sent and how it was used.
function LinksTable({ links }: { links: TesterLinkRow[] }) {
  const now = new Date()
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-charcoal/10">
      <table className="w-full text-sm">
        <caption className="sr-only">One-tap links</caption>
        <thead>
          <tr className="border-b border-charcoal/10 bg-[#f9f9fb]">
            <th className="text-left px-4 py-2 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
              Label
            </th>
            <th className="text-left px-4 py-2 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
              For
            </th>
            <th className="text-left px-4 py-2 font-subhead text-xs text-charcoal-soft uppercase tracking-wide">
              Status
            </th>
            <th className="text-left px-4 py-2 font-subhead text-xs text-charcoal-soft uppercase tracking-wide hidden md:table-cell">
              Expires
            </th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-charcoal/5">
          {links.map((link) => {
            const status = testerLinkStatus(link, now)
            const live = status.state === 'unused' || status.state === 'in_use'
            return (
              <tr key={link.id}>
                <td className="px-4 py-2 font-subhead text-sm font-semibold text-brand-black">
                  {link.label}
                </td>
                <td className="px-4 py-2 font-body text-xs text-charcoal-soft">
                  {link.kind === 'shared'
                    ? 'Shared, anyone'
                    : link.kind === 'supporter'
                      ? 'Supporter'
                      : link.listing_id === null
                        ? 'Owner, no page yet'
                        : 'Listing owner'}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold font-subhead ${LINK_STATUS_CLASS[status.state]}`}
                  >
                    {status.label}
                  </span>
                </td>
                <td className="px-4 py-2 hidden md:table-cell font-body text-xs text-charcoal-soft">
                  {formatDate(link.expires_at)}
                </td>
                <td className="px-4 py-2 text-right">
                  {live && <RevokeLinkButton inviteId={link.id} />}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// Every answer, grouped by the question it answers, newest first within each.
// Reading one question across all testers is how patterns show up.
function AnswersByQuestion({
  reflections,
  numberById,
}: {
  reflections: ReflectionEntry[]
  numberById: Record<string, number>
}) {
  if (reflections.length === 0) {
    return (
      <div className="rounded-xl border border-charcoal/10 bg-white px-6 py-12 text-center">
        <p className={`font-subhead text-sm ${MUTED}`}>
          No answers yet. They appear here the moment a tester writes one on a step of the tour.
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      {REFLECTION_GATED_STEPS.map((step) => {
        const entries = reflections.filter((r) => r.step === step)
        const copy = TOUR_STEP_COPY[step]
        return (
          <section
            key={step}
            aria-labelledby={`q-${step}`}
            className="rounded-xl border border-charcoal/10 bg-white p-5"
          >
            <h2 id={`q-${step}`} className="font-subhead text-sm font-bold text-ink">
              {copy.title}
              <span className={`ml-2 font-normal ${MUTED}`}>
                {entries.length} {entries.length === 1 ? 'answer' : 'answers'}
              </span>
            </h2>
            {copy.prompt && (
              <p className={`mt-1 font-body text-sm italic ${MUTED}`}>{copy.prompt}</p>
            )}
            {entries.length === 0 ? (
              <p className={`mt-3 font-body text-sm ${MUTED}`}>No one has answered this yet.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {entries.map((entry) => (
                  <AnswerItem
                    key={`${entry.enrollmentId}-${entry.step}`}
                    entry={entry}
                    number={numberById[entry.enrollmentId] ?? null}
                  />
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}

function AnswerItem({ entry, number }: { entry: ReflectionEntry; number: number | null }) {
  return (
    <li className="border-l-2 border-gold pl-3">
      <p className="font-body text-sm text-ink whitespace-pre-wrap">{entry.text}</p>
      <p className={`mt-1 font-body text-xs ${MUTED}`}>
        {number !== null ? (
          <Link
            href={`/admin/testers?tester=${String(number).padStart(2, '0')}`}
            className="font-semibold text-amber underline underline-offset-2 hover:text-ink"
          >
            {formatTesterNumber(number)}
          </Link>
        ) : (
          'Unknown tester'
        )}
        {' · '}
        <time dateTime={entry.reflectedAt}>{formatDateTime(entry.reflectedAt)}</time>
      </p>
    </li>
  )
}
