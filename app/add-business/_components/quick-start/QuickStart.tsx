'use client'

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'
import { createListingAction } from '@/lib/actions/listings/createListing'
import { siteFormFields, type SiteDraft } from '@/lib/import/siteDraft'
import { resolveMediaPath } from '@/lib/listings/coverImage'
import { ownershipLabelText } from '@/lib/constants/listing'
import { firstSentence } from '@/lib/listings/draftSeed'
import {
  EMPTY_ANSWERS,
  FIELD_IDS,
  QUICK_STEPS,
  adjacentStepIndex,
  chosenLevel,
  findCta,
  firstMissing,
  fitCategoryId,
  locationLabel,
  pickFor,
  stepForServerField,
  stepProblem,
  visibleSteps,
  whereLocationType,
  type Missing,
  type QuickCategory,
  type QuickStartAnswers,
  type QuickStartMode,
  type QuickStep,
} from '@/lib/listings/quickStart'
import { LivePagePreview, type PreviewPart } from '@/components/listings/LivePagePreview'
import { CreatorFitStep } from './CreatorFitStep'
import { CtaStep } from './CtaStep'
import { FitStep } from './FitStep'
import { NameStep } from './NameStep'
import { RoleStep } from './RoleStep'
import { SiteImportStep } from './SiteImportStep'
import { AboutStep, AttestStep, DraftsChoice, OwnershipStep, TaglineStep } from './TextSteps'
import { WhereStep, type CityOption } from './WhereStep'

// The rules-first quick start (ticket 126): eight short questions beside a live
// page, then "Save my draft" creates the draft and opens the finish view.
// With FEATURE_SITE_IMPORT on, step 0 offers to bring in the owner's own site
// first (ticket 127); what they keep rides along in the draft as `site`.
// Creator mode (ticket 132, `?as=creator`) runs the same steps worded for a
// person, with its own saved draft so the two never mix.

function draftKey(mode: QuickStartMode): string {
  return mode === 'creator' ? 'draft-add-creator-v1' : 'draft-add-business-v2'
}

const HIGHLIGHT: Record<QuickStep, PreviewPart | null> = {
  ownership: 'owner',
  name: 'name',
  about: 'about',
  fit: 'category',
  role: 'category',
  where: 'location',
  cta: 'cta',
  tagline: 'tagline',
  attest: null,
}

interface Props {
  categories: readonly QuickCategory[]
  cities: readonly CityOption[]
  /** The owner's sign-in email: the page's contact email and the "Send a message" default. */
  email: string
  /** FEATURE_SITE_IMPORT: start with "Have a website or link page?". */
  siteImport?: boolean
  /** FEATURE_AI_ONBOARDING: the finish view opens with drafts (ticket 128). */
  aiOnboarding?: boolean
  /** 'creator' for `/add-business?as=creator`; `categories` is then the Creators subcategories. */
  mode?: QuickStartMode
  /** Admin-only name from "Add as a listing" (ticket 168). A draft's own name wins. */
  prefillName?: string
}

type Stage = 'site' | 'steps'

interface Draft {
  answers: QuickStartAnswers
  stepIndex: number
  /** Missing on drafts saved before step 0 existed. */
  stage?: Stage
  site: SiteDraft | null
}

function readDraft(key: string): Draft {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return { answers: EMPTY_ANSWERS, stepIndex: 0, site: null }
    const parsed = JSON.parse(raw) as Partial<Draft>
    const stepIndex = Number.isInteger(parsed.stepIndex)
      ? Math.min(Math.max(parsed.stepIndex as number, 0), QUICK_STEPS.length - 1)
      : 0
    // An older draft already under way resumes at its step, not at step 0.
    const stage: Stage | undefined =
      parsed.stage === 'site' || parsed.stage === 'steps'
        ? parsed.stage
        : parsed.answers
          ? 'steps'
          : undefined
    const site = parsed.site && typeof parsed.site.tempId === 'string' ? parsed.site : null
    const answers = { ...EMPTY_ANSWERS, ...(parsed.answers ?? {}) }
    // Drafts saved before Black-owned became the default carry ''.
    if (answers.ownership !== 'ally') answers.ownership = 'black_owned'
    return { answers, stepIndex, stage, site }
  } catch {
    return { answers: EMPTY_ANSWERS, stepIndex: 0, site: null }
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

function QuickStartFlow({
  categories,
  cities,
  email,
  siteImport = false,
  aiOnboarding = false,
  mode = 'business',
  prefillName,
}: Props) {
  const router = useRouter()
  const creator = mode === 'creator'
  const DRAFT_KEY = draftKey(mode)
  const [initial] = useState(() => readDraft(DRAFT_KEY))
  const [answers, setAnswers] = useState<QuickStartAnswers>(() =>
    prefillName && !initial.answers.name.trim()
      ? { ...initial.answers, name: prefillName }
      : initial.answers
  )
  const [stepIndex, setStepIndex] = useState(initial.stepIndex)
  const [stage, setStage] = useState<Stage>(siteImport ? (initial.stage ?? 'site') : 'steps')
  const [site, setSite] = useState<SiteDraft | null>(siteImport ? initial.site : null)
  const [problem, setProblem] = useState<Missing | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  // AI drafts after saving are opt-out by the owner on the last step (ticket 128).
  const [wantDrafts, setWantDrafts] = useState(true)
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
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, stepIndex, stage, site }))
    } catch {
      // Private mode or storage full. The flow still works, it just won't resume.
    }
  }, [DRAFT_KEY, answers, stepIndex, stage, site])

  useEffect(() => {
    if (navCount === 0) return
    const id = focusNext.current ?? 'qs-step-title'
    focusNext.current = null
    document.getElementById(id)?.focus()
  }, [navCount])

  function update(patch: Partial<QuickStartAnswers>) {
    // Picking "Call" or "Visit our site" starts with what came from their site.
    const input = patch.ctaType ? findCta(patch.ctaType, mode)?.input : undefined
    if (input === 'tel' && !patch.ctaUrl && site?.phone) patch = { ...patch, ctaUrl: site.phone }
    if (patch.ctaType === 'visit' && !patch.ctaUrl && site?.website)
      patch = { ...patch, ctaUrl: site.website }
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
    const p = stepProblem(step, answers, mode)
    if (p) {
      goTo(stepIndex, p)
      return
    }
    goTo(adjacentStepIndex(stepIndex, 1, answers, categories))
  }

  function back() {
    if (stepIndex === 0 && siteImport) {
      setStage('site')
      setNavCount((n) => n + 1)
      return
    }
    goTo(adjacentStepIndex(stepIndex, -1, answers, categories))
  }

  function leaveSite(patch: Partial<QuickStartAnswers> | null, kept: SiteDraft | null) {
    if (patch) setAnswers((prev) => ({ ...prev, ...patch }))
    if (kept) setSite(kept)
    setStage('steps')
    goTo(0)
  }

  function submit() {
    setFormError(null)
    const missing = firstMissing(answers, mode)
    if (missing) {
      goTo(QUICK_STEPS.indexOf(missing.step), missing)
      return
    }
    const cta = findCta(answers.ctaType, mode)
    const fd = new FormData()
    fd.set(
      'entity_type',
      creator ? 'creator' : (pickFor(answers, categories)?.entityType ?? 'business')
    )
    fd.set('name', answers.name.trim())
    fd.set('category_id', fitCategoryId(answers.fit))
    const level = chosenLevel(answers, categories)
    if (level) fd.set('primary_level', level)
    fd.set('description', answers.about.trim())
    fd.set('tagline', answers.tagline.trim())
    fd.set('location_type', whereLocationType(answers.where, mode))
    if (creator || answers.where !== 'online') {
      if (answers.cityId) fd.set('city_id', answers.cityId)
      else if (!creator || answers.cityText.trim()) {
        fd.set('city_text', answers.cityText.trim())
        fd.set('state_text', answers.stateText.trim())
      }
    }
    fd.set('cta_type', answers.ctaType)
    fd.set('cta_url', answers.ctaUrl.trim())
    if (cta?.input === 'tel') fd.set('phone', answers.ctaUrl.trim())
    else if (site?.phone) fd.set('phone', site.phone)
    fd.set('email', site?.email ?? email)
    fd.set('ownership_label', answers.ownership)
    fd.set('ownership_attested', 'true')
    if (creator) fd.set('age_attested', answers.ageAttested ? 'true' : 'false')
    if (cta?.labelOverride) fd.set('cta_label_override', cta.labelOverride)
    if (answers.fit?.kind === 'request') {
      fd.set('category_request_name', answers.fit.proposedName.trim())
      fd.set('category_request_words', answers.fit.words.trim())
    }
    if (site) for (const [key, value] of siteFormFields(site)) fd.set(key, value)

    startTransition(async () => {
      const result = await createListingAction(null, fd)
      if (result && 'success' in result) {
        try {
          window.localStorage.removeItem(DRAFT_KEY)
        } catch {
          // Nothing to clean up.
        }
        const params = new URLSearchParams()
        if (result.warning) params.set('warning', 'request')
        if (aiOnboarding && wantDrafts) {
          params.set('drafts', '1')
          // Imported about text goes to the drafts as quoted text, not as the owner's words.
          if (fromSiteTag('about', site, answers)) params.set('from', 'site')
        }
        const qs = params.size > 0 ? `?${params.toString()}` : ''
        router.push(`/add-business/finish/${result.listingId}${qs}`)
        return
      }
      const errors = result?.fieldErrors ?? {}
      for (const [field, reason] of Object.entries(errors)) {
        const target = stepForServerField(field)
        if (!target || !reason) continue
        goTo(QUICK_STEPS.indexOf(target), {
          step: target,
          fieldId: serverFieldId(target, field),
          reason,
        })
        return
      }
      setFormError(result?.error ?? 'Something went wrong. Please try again.')
    })
  }

  // ── The live page ─────────────────────────────────────────────────────────
  const preview = useMemo(() => {
    const fit = answers.fit
    let categoryName: string | null = null
    if (fit?.kind === 'category')
      categoryName = categories.find((c) => c.id === fit.categoryId)?.name ?? null
    if (fit?.kind === 'request')
      categoryName =
        fit.proposedName.trim() || categories.find((c) => c.id === fit.parentId)?.name || null
    return {
      name: answers.name.trim(),
      tagline: answers.tagline.trim() || firstSentence(answers.about),
      description: answers.about.trim(),
      categoryName,
      locationLabel: locationLabel(answers, cities, mode),
      // Matches the live page: only Ally is named (2026-10-16, creators too 2026-10-19).
      ownershipLabel:
        answers.ownership === 'ally' ? ownershipLabelText('ally', creator ? 'creator' : null) : null,
      ctaLabel: findCta(answers.ctaType, mode)?.buttonLabel ?? null,
      coverUrl: resolveMediaPath(site?.coverPath),
      highlight: stage === 'site' ? null : HIGHLIGHT[step],
    }
  }, [answers, categories, cities, step, stage, site, mode, creator])

  const stepProps = { answers, onChange: update, problem, mode }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10">
      <div className="lg:hidden">
        <LivePagePreview {...preview} compact />
      </div>

      {stage === 'site' ? (
        <div className="min-w-0">
          <SiteImportStep
            answers={answers}
            cities={cities}
            signInEmail={email}
            onDone={(patch, kept) => leaveSite(patch, kept)}
            onSkip={() => leaveSite(null, null)}
          />
        </div>
      ) : (
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
          <Progress steps={visibleSteps(answers, categories)} current={step} />

          <div key={step} className="flex flex-col gap-5">
            {fromSiteTag(step, site, answers) && (
              <p className="w-fit rounded-full bg-amber-gold/20 px-3 py-1 font-subhead text-xs font-semibold uppercase tracking-widest text-brand-black">
                From your site. Check it over.
              </p>
            )}
            {step === 'ownership' && <OwnershipStep {...stepProps} />}
            {step === 'name' && <NameStep {...stepProps} />}
            {step === 'about' && <AboutStep {...stepProps} />}
            {step === 'fit' &&
              (creator ? (
                <CreatorFitStep
                  {...stepProps}
                  categories={categories}
                  onPicked={(fit) => goTo(adjacentStepIndex(stepIndex, 1, { fit }, categories))}
                />
              ) : (
                <FitStep
                  {...stepProps}
                  categories={categories}
                  // The fit just changed, so read the role question's rule off
                  // the new answer rather than the render's stale one.
                  onPicked={(fit) => goTo(adjacentStepIndex(stepIndex, 1, { fit }, categories))}
                />
              ))}
            {step === 'role' && <RoleStep {...stepProps} categories={categories} />}
            {step === 'where' && <WhereStep {...stepProps} cities={cities} />}
            {step === 'cta' && <CtaStep {...stepProps} email={site?.email ?? email} />}
            {step === 'tagline' && <TaglineStep {...stepProps} />}
            {step === 'attest' && <AttestStep {...stepProps} />}
            {step === 'attest' && aiOnboarding && (
              <DraftsChoice checked={wantDrafts} onChange={setWantDrafts} />
            )}
          </div>

          {formError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-4 py-3 font-subhead text-sm font-semibold text-red-700"
            >
              {formError}
            </p>
          )}

          <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-charcoal/10 bg-pale-lavender/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            {(stepIndex > 0 || siteImport) && (
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
                isLast
                  ? 'bg-amber-gold text-brand-black hover:brightness-95'
                  : 'bg-brand-black text-white hover:bg-charcoal'
              )}
            >
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isLast ? (pending ? 'Saving…' : 'Save my draft') : 'Next'}
            </button>
          </div>
        </form>
      )}

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

/** True when this step's answer came from the owner's site. */
function fromSiteTag(step: QuickStep, site: SiteDraft | null, answers: QuickStartAnswers): boolean {
  if (!site) return false
  if (step === 'cta') {
    const v = answers.ctaUrl.trim()
    return Boolean(v) && (v === site.phone || v === site.website)
  }
  return site.fromSite.includes(step)
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
    case 'role':
      return FIELD_IDS.role
    case 'where':
      return FIELD_IDS.where
    case 'cta':
      return field === 'cta_type' ? FIELD_IDS.ctaType : FIELD_IDS.ctaUrl
    case 'tagline':
      return FIELD_IDS.tagline
    case 'attest':
      return field === 'age_attested' ? FIELD_IDS.age : FIELD_IDS.attest
  }
}

/** Counts only the steps this owner sees, so a skipped role question never shows as a gap. */
function Progress({ steps, current }: { steps: readonly QuickStep[]; current: QuickStep }) {
  const total = steps.length
  const index = Math.max(steps.indexOf(current), 0)
  return (
    <div className="flex flex-col gap-2">
      <p className="font-subhead text-sm font-semibold text-charcoal-soft tabular-nums">
        Step {index + 1} of {total}
      </p>
      <div className="flex gap-1" aria-hidden="true">
        {steps.map((s, i) => (
          <span
            key={s}
            className={cn(
              'h-1.5 flex-1 rounded-full',
              i <= index ? 'bg-brand-black' : 'bg-charcoal/15'
            )}
          />
        ))}
      </div>
    </div>
  )
}

function QuickStartSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-10"
      aria-busy="true"
    >
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
