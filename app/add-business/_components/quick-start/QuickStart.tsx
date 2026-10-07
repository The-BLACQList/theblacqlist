'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { createListingAction } from '@/lib/actions/listings/createListing'
import type { GuideCategory } from '@/lib/categories/sorting-guide'
import { OWNERSHIP_LABEL_META } from '@/lib/constants/listing'
import { firstSentence } from '@/lib/listings/draftSeed'
import {
  EMPTY_ANSWERS,
  FIELD_IDS,
  QUICK_STEPS,
  findCta,
  firstMissing,
  fitCategoryId,
  locationLabel,
  pickFor,
  stepForServerField,
  stepProblem,
  whereLocationType,
  type Missing,
  type QuickStartAnswers,
  type QuickStep,
} from '@/lib/listings/quickStart'
import { LivePagePreview, type PreviewPart } from '@/components/listings/LivePagePreview'
import { CtaStep } from './CtaStep'
import { FitStep } from './FitStep'
import { NameStep } from './NameStep'
import { AboutStep, AttestStep, OwnershipStep, TaglineStep } from './TextSteps'
import { WhereStep, type CityOption } from './WhereStep'

// The rules-first quick start (ticket 126): eight short questions beside a live
// page, then "Save my draft" creates the draft and opens the finish view.

const DRAFT_KEY = 'draft-add-business-v2'

const HIGHLIGHT: Record<QuickStep, PreviewPart | null> = {
  ownership: 'owner',
  name: 'name',
  about: 'about',
  fit: 'category',
  where: 'location',
  cta: 'cta',
  tagline: 'tagline',
  attest: null,
}

interface Props {
  categories: readonly GuideCategory[]
  cities: readonly CityOption[]
  /** The owner's sign-in email: the page's contact email and the "Send a message" default. */
  email: string
}

interface Draft {
  answers: QuickStartAnswers
  stepIndex: number
}

function readDraft(): Draft {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return { answers: EMPTY_ANSWERS, stepIndex: 0 }
    const parsed = JSON.parse(raw) as Partial<Draft>
    const stepIndex = Number.isInteger(parsed.stepIndex)
      ? Math.min(Math.max(parsed.stepIndex as number, 0), QUICK_STEPS.length - 1)
      : 0
    return { answers: { ...EMPTY_ANSWERS, ...(parsed.answers ?? {}) }, stepIndex }
  } catch {
    return { answers: EMPTY_ANSWERS, stepIndex: 0 }
  }
}

const noopSubscribe = () => () => {}

/** Renders the flow only in the browser, where the saved draft can be read. */
export function QuickStart(props: Props) {
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
  if (!hydrated) return <QuickStartSkeleton />
  return <QuickStartFlow {...props} />
}

function QuickStartFlow({ categories, cities, email }: Props) {
  const router = useRouter()
  const [initial] = useState(readDraft)
  const [answers, setAnswers] = useState<QuickStartAnswers>(initial.answers)
  const [stepIndex, setStepIndex] = useState(initial.stepIndex)
  const [problem, setProblem] = useState<Missing | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  // What to focus after the next render: a field with a problem, else the step heading.
  const focusNext = useRef<string | null>(null)
  // Bumped on every Next, Back or jump, so focus moves only on navigation and
  // never while the owner is typing.
  const [navCount, setNavCount] = useState(0)

  const step = QUICK_STEPS[stepIndex] ?? 'ownership'
  const isLast = stepIndex === QUICK_STEPS.length - 1

  useEffect(() => {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, stepIndex }))
    } catch {
      // Private mode or storage full. The flow still works, it just won't resume.
    }
  }, [answers, stepIndex])

  useEffect(() => {
    if (navCount === 0) return
    const id = focusNext.current ?? 'qs-step-title'
    focusNext.current = null
    document.getElementById(id)?.focus()
  }, [navCount])

  function update(patch: Partial<QuickStartAnswers>) {
    setAnswers((prev) => ({ ...prev, ...patch }))
    setFormError(null)
    // Clear the message once the owner starts fixing it.
    if (problem) setProblem(null)
  }

  function goTo(index: number, withProblem: Missing | null = null) {
    focusNext.current = withProblem?.fieldId ?? null
    setProblem(withProblem)
    setStepIndex(index)
    setNavCount((n) => n + 1)
  }

  function next() {
    const p = stepProblem(step, answers)
    if (p) {
      goTo(stepIndex, p)
      return
    }
    goTo(Math.min(stepIndex + 1, QUICK_STEPS.length - 1))
  }

  function back() {
    goTo(Math.max(stepIndex - 1, 0))
  }

  function submit() {
    setFormError(null)
    const missing = firstMissing(answers)
    if (missing) {
      goTo(QUICK_STEPS.indexOf(missing.step), missing)
      return
    }
    const pick = pickFor(answers, categories)
    const cta = findCta(answers.ctaType)
    const fd = new FormData()
    fd.set('entity_type', pick?.entityType ?? 'business')
    fd.set('name', answers.name.trim())
    fd.set('category_id', fitCategoryId(answers.fit))
    fd.set('description', answers.about.trim())
    fd.set('tagline', answers.tagline.trim())
    fd.set('location_type', whereLocationType(answers.where))
    if (answers.where !== 'online') {
      if (answers.cityId) fd.set('city_id', answers.cityId)
      else {
        fd.set('city_text', answers.cityText.trim())
        fd.set('state_text', answers.stateText.trim())
      }
    }
    fd.set('cta_type', answers.ctaType)
    fd.set('cta_url', answers.ctaUrl.trim())
    if (cta?.input === 'tel') fd.set('phone', answers.ctaUrl.trim())
    fd.set('email', email)
    fd.set('ownership_label', answers.ownership)
    fd.set('ownership_attested', 'true')
    if (answers.fit?.kind === 'request') {
      fd.set('category_request_name', answers.fit.proposedName.trim())
      fd.set('category_request_words', answers.fit.words.trim())
    }

    startTransition(async () => {
      const result = await createListingAction(null, fd)
      if (result && 'success' in result) {
        try {
          window.localStorage.removeItem(DRAFT_KEY)
        } catch {
          // Nothing to clean up.
        }
        const qs = result.warning ? '?warning=request' : ''
        router.push(`/add-business/finish/${result.listingId}${qs}`)
        return
      }
      const errors = result?.fieldErrors ?? {}
      for (const [field, reason] of Object.entries(errors)) {
        const target = stepForServerField(field)
        if (!target || !reason) continue
        goTo(QUICK_STEPS.indexOf(target), { step: target, fieldId: serverFieldId(target, field), reason })
        return
      }
      setFormError(result?.error ?? 'Something went wrong. Please try again.')
    })
  }

  // ── The live page ─────────────────────────────────────────────────────────
  const preview = useMemo(() => {
    const fit = answers.fit
    let categoryName: string | null = null
    if (fit?.kind === 'category') categoryName = categories.find((c) => c.id === fit.categoryId)?.name ?? null
    if (fit?.kind === 'request')
      categoryName = fit.proposedName.trim() || categories.find((c) => c.id === fit.parentId)?.name || null
    return {
      name: answers.name.trim(),
      tagline: answers.tagline.trim() || firstSentence(answers.about),
      description: answers.about.trim(),
      categoryName,
      locationLabel: locationLabel(answers, cities),
      ownershipLabel: answers.ownership ? OWNERSHIP_LABEL_META[answers.ownership].label : null,
      ctaLabel: findCta(answers.ctaType)?.buttonLabel ?? null,
      highlight: HIGHLIGHT[step],
    }
  }, [answers, categories, cities, step])

  const stepProps = { answers, onChange: update, problem }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
      <div className="lg:hidden">
        <LivePagePreview {...preview} compact />
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (isLast) submit()
          else next()
        }}
        className="flex min-w-0 flex-col gap-6"
        aria-labelledby="qs-step-title"
      >
        <Progress index={stepIndex} />

        <div key={step} className="flex flex-col gap-5">
          {step === 'ownership' && <OwnershipStep {...stepProps} />}
          {step === 'name' && <NameStep {...stepProps} />}
          {step === 'about' && <AboutStep {...stepProps} />}
          {step === 'fit' && (
            <FitStep {...stepProps} categories={categories} onPicked={() => goTo(stepIndex + 1)} />
          )}
          {step === 'where' && <WhereStep {...stepProps} cities={cities} />}
          {step === 'cta' && <CtaStep {...stepProps} email={email} />}
          {step === 'tagline' && <TaglineStep {...stepProps} />}
          {step === 'attest' && <AttestStep {...stepProps} />}
        </div>

        {formError && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 font-subhead text-sm font-semibold text-red-700">
            {formError}
          </p>
        )}

        <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-charcoal/10 bg-pale-lavender/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={back}
              disabled={pending}
              className="inline-flex h-12 items-center gap-1.5 rounded-full px-4 font-subhead text-base font-semibold text-brand-black hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black disabled:opacity-50"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </button>
          )}
          <button
            type="submit"
            disabled={pending}
            className={cn(
              'ml-auto inline-flex h-12 min-w-[9rem] items-center justify-center gap-2 rounded-full px-6 font-subhead text-base font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2 disabled:opacity-70',
              isLast ? 'bg-amber-gold text-brand-black hover:brightness-95' : 'bg-brand-black text-white hover:bg-charcoal'
            )}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isLast ? (pending ? 'Saving…' : 'Save my draft') : 'Next'}
          </button>
        </div>
      </form>

      <aside className="hidden lg:block" aria-label="Your page so far">
        <div className="sticky top-24 flex flex-col gap-3">
          <p className="font-subhead text-xs font-semibold uppercase tracking-widest text-charcoal-soft">
            Your page so far
          </p>
          <LivePagePreview {...preview} />
        </div>
      </aside>
    </div>
  )
}

/** The input a server field error points at. */
function serverFieldId(step: QuickStep, field: string): string {
  switch (step) {
    case 'ownership':
      return FIELD_IDS.ownership
    case 'name':
      return FIELD_IDS.name
    case 'about':
      return FIELD_IDS.about
    case 'fit':
      return field === 'category_request_name' ? FIELD_IDS.requestName : FIELD_IDS.fit
    case 'where':
      return FIELD_IDS.where
    case 'cta':
      return field === 'cta_type' ? FIELD_IDS.ctaType : FIELD_IDS.ctaUrl
    case 'tagline':
      return FIELD_IDS.tagline
    case 'attest':
      return FIELD_IDS.attest
  }
}

function Progress({ index }: { index: number }) {
  const total = QUICK_STEPS.length
  return (
    <div className="flex flex-col gap-2">
      <p className="font-subhead text-sm font-semibold text-charcoal-soft tabular-nums">
        Step {index + 1} of {total}
      </p>
      <div className="flex gap-1" aria-hidden="true">
        {QUICK_STEPS.map((s, i) => (
          <span
            key={s}
            className={cn('h-1.5 flex-1 rounded-full', i <= index ? 'bg-brand-black' : 'bg-charcoal/15')}
          />
        ))}
      </div>
    </div>
  )
}

function QuickStartSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10" aria-busy="true">
      <div className="flex flex-col gap-6">
        <div className="h-5 w-28 motion-safe:animate-pulse rounded bg-charcoal/10" />
        <div className="h-8 w-3/4 motion-safe:animate-pulse rounded bg-charcoal/10" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="h-[72px] motion-safe:animate-pulse rounded-xl bg-charcoal/10" />
          <div className="h-[72px] motion-safe:animate-pulse rounded-xl bg-charcoal/10" />
        </div>
      </div>
      <div className="hidden h-[420px] motion-safe:animate-pulse rounded-2xl bg-charcoal/10 lg:block" />
      <span className="sr-only">Loading</span>
    </div>
  )
}
