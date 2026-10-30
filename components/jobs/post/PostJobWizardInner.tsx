'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { postJobAction } from '@/lib/actions/listings/postJob'
import {
  POST_JOB_STEPS,
  firstStepWithError,
  validatePostJob,
  validatePostJobStep,
  type PostJobErrors,
  type PostJobField,
} from '@/lib/validations/postJob'
import type { JobPriceLine } from '@/lib/listings/jobPriceLine'
import type { CategoryOption } from '@/app/add-business/page'
import { JobPreview } from './JobPreview'
import { StepRole } from './StepRole'
import { StepPayPlace } from './StepPayPlace'
import { StepApply } from './StepApply'
import { StepReview } from './StepReview'
import { usePostJobDraft, type SavedDraft } from './usePostJobDraft'
import type { HiringBusiness } from './types'

interface Props {
  businesses: HiringBusiness[]
  categories: CategoryOption[]
  priceLine: JobPriceLine
  saved: SavedDraft | null
}

const LAST = POST_JOB_STEPS.length - 1
const btn = 'inline-flex h-11 min-w-11 items-center justify-center rounded-full px-6 font-subhead text-sm font-bold disabled:opacity-60'

export function PostJobWizardInner({ businesses, categories, priceLine, saved }: Props) {
  const router = useRouter()
  const { values, setValues, step, setStep, attemptId, clearDraft } = usePostJobDraft(
    businesses.map((b) => b.id),
    saved
  )
  const [errors, setErrors] = useState<PostJobErrors>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const moved = useRef(false)

  const business = businesses.find((b) => b.id === values.hiringListingId) ?? null
  const categoryName = categories.find((c) => c.id === values.categoryId)?.name ?? null

  useEffect(() => {
    if (moved.current) headingRef.current?.focus()
    moved.current = true
  }, [step])

  function set(field: PostJobField, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e))
  }

  function next() {
    const errs = validatePostJobStep(values, step)
    setErrors(errs)
    if (Object.keys(errs).length === 0) setStep(step + 1)
  }

  async function submit() {
    const errs = validatePostJob(values)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      setStep(firstStepWithError(errs) ?? 0)
      return
    }
    setSubmitting(true)
    setBanner(null)
    try {
      const res = await postJobAction({ values, attemptId })
      if (!res.ok) {
        const fe = (res.fieldErrors ?? {}) as PostJobErrors
        setErrors(fe)
        setBanner(res.error)
        const bad = firstStepWithError(fe)
        if (bad !== null) setStep(bad)
        return
      }
      clearDraft()
      if (res.outcome === 'checkout' && res.checkoutUrl) {
        window.location.assign(res.checkoutUrl)
        return
      }
      // TODO(153): send to /dashboard/pages/[entityId]/posted once that page ships.
      router.push(`/dashboard/pages/${res.listingId}`)
    } catch {
      setBanner('We could not reach the server. Your answers are saved here. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const errorList = Object.entries(errors).filter(([, m]) => m) as [PostJobField, string][]
  const noBusiness = businesses.length === 0

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (step < LAST) next()
        else void submit()
      }}
      className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10 pb-24 lg:pb-0"
    >
      <div>
        <p className="font-subhead text-xs font-semibold uppercase tracking-widest text-charcoal-soft mb-1">
          Step {step + 1} of {POST_JOB_STEPS.length}
        </p>
        {errorList.length > 0 && (
          <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 font-subhead text-sm text-red-800">
            <p className="font-semibold">Fix these to continue:</p>
            <ul className="list-disc pl-5">
              {errorList.map(([f, m]) => (
                <li key={f}>{m}</li>
              ))}
            </ul>
          </div>
        )}
        {banner && errorList.length === 0 && (
          <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 font-subhead text-sm text-red-800">
            {banner}{' '}
            <button type="button" onClick={() => void submit()} className="font-semibold underline min-h-11">
              Try again
            </button>
          </div>
        )}
        <fieldset disabled={submitting} className="min-w-0">
          <legend className="sr-only">{POST_JOB_STEPS[step]}</legend>
          <h2 ref={headingRef} tabIndex={-1} className="font-headline text-2xl text-brand-black mb-5 focus:outline-none">
            {POST_JOB_STEPS[step]}
          </h2>
          {step === 0 && <StepRole values={values} errors={errors} set={set} businesses={businesses} categories={categories} />}
          {step === 1 && <StepPayPlace values={values} errors={errors} set={set} business={business} />}
          {step === 2 && <StepApply values={values} errors={errors} set={set} />}
          {step === 3 && (
            <StepReview values={values} business={business} categoryName={categoryName} priceLine={priceLine} onEdit={setStep} />
          )}
        </fieldset>

        {step < LAST && (
          <div className="mt-6 lg:hidden">
            <JobPreview values={values} business={business} />
          </div>
        )}
        {step === LAST && (
          <details className="mt-6 lg:hidden rounded-lg border border-charcoal/15 bg-white p-3">
            <summary className="cursor-pointer min-h-11 flex items-center font-subhead text-sm font-semibold">
              See how it looks
            </summary>
            <div className="mt-3">
              <JobPreview values={values} business={business} />
            </div>
          </details>
        )}
        {step === LAST && (
          <p className="mt-4 font-subhead text-xs text-charcoal-soft">
            Our team reviews every role before it goes live. This usually takes 3 to 5 business days.
          </p>
        )}

        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-charcoal/15 bg-white px-4 py-3 lg:static lg:mt-6 lg:border-0 lg:bg-transparent lg:p-0">
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} disabled={submitting} className={`${btn} border border-charcoal/30 bg-white text-brand-black`}>
              Back
            </button>
          ) : (
            <span />
          )}
          {step < LAST ? (
            <button type="submit" disabled={noBusiness} className={`${btn} bg-amber-gold text-brand-black`}>
              Next
            </button>
          ) : (
            <button type="submit" disabled={submitting || noBusiness} className={`${btn} bg-amber-gold text-brand-black`}>
              {submitting ? 'Submitting…' : priceLine.button}
            </button>
          )}
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-24">
          <JobPreview values={values} business={business} />
        </div>
      </aside>
    </form>
  )
}
