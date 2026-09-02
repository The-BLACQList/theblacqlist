'use client'

// The Tester Tour rail: a fixed panel enrolled testers see on every public
// page (tester-tour-spec.md §7). The client stays deliberately dumb — all six
// per-step verdicts arrive pre-resolved from GET /api/tour/state as
// { key, title, gated, status, prompt, message }; this file never imports
// lib/tour/verify.ts and never derives a status itself. In particular the
// 'act' vs 'retry' distinction (verified absence vs failed read) is decided
// server-side and only RENDERED here, so no client code path can tell a
// tester who already did a thing to go do it.
//
// z-40 keeps the rail under the z-50 fixed header. Route hiding uses PREFIX
// matching — deliberately unlike ChromeGate's exact equality, because /admin
// has children and the rail must not float over any of them.

import { useActionState, useCallback, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'
import { Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'

import {
  submitReflectionAction,
  type ReflectionState,
} from '@/lib/actions/tour/submitReflection'
import { REFLECTION_MIN_LENGTH } from '@/lib/tour/steps'
// Prefix-hidden routes. The rail belongs on the public marketplace surfaces
// the tour walks (search, listings, collections, reviews) — not over the
// admin console, the coming-soon gate, auth flows, or onboarding. The policy
// lives in lib/tour/routes.ts so it is testable outside a client chunk.
import { isHiddenPath } from '@/lib/tour/routes'
import { ClaimTrialButton } from './ClaimTrialButton'

// Mirrors the /api/tour/state response shape. Kept local so the client chunk
// carries no server-module imports.
type TourStepStatus = 'done' | 'reflect' | 'act' | 'retry'

interface TourStepState {
  key: string
  title: string
  gated: boolean
  status: TourStepStatus
  prompt: string | null
  message: string | null
}

interface TourState {
  listingId: string
  completedAt: string | null
  trialGrantedAt: string | null
  canClaim: boolean
  steps: TourStepState[]
}

type LoadPhase = 'loading' | 'ready' | 'failed' | 'gone'

export function TourRail() {
  const pathname = usePathname()
  const router = useRouter()
  const [phase, setPhase] = useState<LoadPhase>('loading')
  const [tour, setTour] = useState<TourState | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  // Bumping this refetches /api/tour/state (retry, saved reflection). The
  // fetch lives in the effect, deferred through setTimeout with an abort on
  // cleanup — the ListingCombobox pattern — so no setState runs synchronously
  // inside the effect body and nothing fires after unmount.
  const [fetchKey, setFetchKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/tour/state', {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (res.status === 404) {
          // The server mounted the rail but the API no longer recognises the
          // viewer (flag flipped off mid-session, enrollment ended). Vanish.
          setPhase('gone')
          return
        }
        if (!res.ok) {
          setPhase('failed')
          return
        }
        const body = (await res.json()) as { data?: TourState }
        if (!body.data) {
          setPhase('failed')
          return
        }
        setTour(body.data)
        setPhase('ready')
      } catch {
        if (!controller.signal.aborted) setPhase('failed')
      }
    }, 0)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [fetchKey])

  // After a saved reflection the server may have stamped completion or
  // flipped step statuses — refetch the rail's state AND refresh the server
  // tree (the action deliberately calls no revalidatePath).
  const handleReflectionSaved = useCallback(() => {
    setFetchKey((k) => k + 1)
    router.refresh()
  }, [router])

  if (isHiddenPath(pathname) || phase === 'gone') return null

  const doneCount = tour?.steps.filter((s) => s.status === 'done').length ?? 0
  const totalCount = tour?.steps.length ?? 6

  if (collapsed) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
          className="inline-flex items-center gap-2 rounded-full border border-amber-gold/40 bg-deep-bg px-4 py-2 font-subhead text-sm text-cream shadow-lg transition-colors hover:border-amber-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
        >
          <span className="font-bold text-amber-gold">Tester Tour</span>
          <span>
            {doneCount}/{totalCount}
          </span>
          <ChevronUp className="size-4" aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <aside
      aria-label="Tester Tour progress"
      className="fixed bottom-4 right-4 z-40 flex max-h-[70vh] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-amber-gold/40 bg-deep-bg text-cream shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="font-subhead text-sm font-bold text-amber-gold">
          Tester Tour{' '}
          <span className="font-normal text-cream">
            · {doneCount}/{totalCount}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          aria-expanded={true}
          aria-label="Collapse the tour panel"
          className="rounded-full p-1 text-cream/70 transition-colors hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
        >
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="overflow-y-auto px-4 py-3">
        {phase === 'loading' && (
          <p className="flex items-center gap-2 py-4 font-subhead text-sm text-cream/70">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading your tour…
          </p>
        )}

        {phase === 'failed' && (
          // One rail-level retry — the API 500s rather than sending per-step
          // guesses, so the rail must not render six confident step states it
          // does not have.
          <div className="py-4">
            <p className="font-subhead text-sm text-cream/80">
              Couldn&apos;t load your tour progress.
            </p>
            <button
              type="button"
              onClick={() => {
                setPhase('loading')
                setFetchKey((k) => k + 1)
              }}
              className="mt-2 rounded-full border border-amber-gold/60 px-4 py-1.5 font-subhead text-sm font-bold text-amber-gold transition-colors hover:bg-amber-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
            >
              Try again
            </button>
          </div>
        )}

        {phase === 'ready' && tour && (
          <>
            <ol className="space-y-3">
              {tour.steps.map((step, index) => (
                <TourStep
                  key={step.key}
                  step={step}
                  index={index}
                  onReflectionSaved={handleReflectionSaved}
                />
              ))}
            </ol>

            {tour.completedAt !== null && (
              <div className="mt-4 border-t border-white/10 pt-4">
                <p className="font-subhead text-sm text-cream/90">
                  {tour.trialGrantedAt === null
                    ? 'Tour complete — your 30-day Starter trial is ready to claim.'
                    : 'Tour complete. Your trial claim is in — resume checkout if you didn’t finish it.'}
                </p>
                <ClaimTrialButton claimed={tour.trialGrantedAt !== null} />
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  )
}

function TourStep({
  step,
  index,
  onReflectionSaved,
}: {
  step: TourStepState
  index: number
  onReflectionSaved: () => void
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-subhead text-xs font-bold ${
          step.status === 'done'
            ? 'border-amber-gold bg-amber-gold/20 text-amber-gold'
            : 'border-white/25 text-cream/70'
        }`}
      >
        {step.status === 'done' ? <Check className="size-3.5" /> : index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-subhead text-sm font-bold text-cream">
          {step.title}
          {step.status === 'done' && <span className="sr-only"> — done</span>}
        </p>
        {(step.status === 'act' || step.status === 'retry') && step.message && (
          <p className="mt-1 font-subhead text-sm text-cream/70">{step.message}</p>
        )}
        {step.status === 'reflect' && (
          <ReflectionForm step={step} onSaved={onReflectionSaved} />
        )}
      </div>
    </li>
  )
}

function ReflectionSubmit() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full bg-amber-gold px-4 py-1.5 font-subhead text-sm font-bold text-brand-black transition-colors hover:bg-light-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2 focus-visible:ring-offset-deep-bg disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? 'Saving…' : 'Save reflection'}
    </button>
  )
}

function ReflectionForm({
  step,
  onSaved,
}: {
  step: TourStepState
  onSaved: () => void
}) {
  const [state, action] = useActionState<ReflectionState, FormData>(
    submitReflectionAction,
    null
  )
  // CONTROLLED on purpose: React 19 resets an uncontrolled
  // <form action={…}> when the action resolves, which would wipe the
  // tester's text on every validation failure (the recorded debt-⑰ defect
  // class). A controlled value survives the reset.
  const [text, setText] = useState('')

  const succeeded = state !== null && 'success' in state && state.success
  const error = state !== null && 'error' in state ? state.error : null

  useEffect(() => {
    if (succeeded) onSaved()
  }, [succeeded, onSaved])

  // The refetch triggered by onSaved flips this step to 'done' and unmounts
  // the form; until then, show the saved state instead of an editable form.
  if (succeeded) {
    return (
      <p role="status" className="mt-1 font-subhead text-sm text-amber-gold">
        Reflection saved.
      </p>
    )
  }

  const errorId = error ? `tour-reflection-error-${step.key}` : undefined

  return (
    <form action={action} className="mt-2" noValidate>
      <input type="hidden" name="step" value={step.key} />
      <label
        htmlFor={`tour-reflection-${step.key}`}
        className="font-subhead text-sm text-cream/80"
      >
        {step.prompt}
      </label>
      <textarea
        id={`tour-reflection-${step.key}`}
        name="reflection"
        rows={3}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={errorId}
        placeholder={`At least ${REFLECTION_MIN_LENGTH} characters`}
        className="mt-1.5 w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 font-subhead text-sm text-white placeholder:text-cream/40 focus:border-amber-gold focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
      />
      {error && (
        <p id={errorId} role="alert" className="mb-2 font-subhead text-sm text-light-gold">
          {error}
        </p>
      )}
      <ReflectionSubmit />
    </form>
  )
}
