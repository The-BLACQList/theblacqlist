'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, ChevronRight, Store, Search } from 'lucide-react'

import { setOnboardingRoleAction } from '@/lib/actions/account/setOnboardingRole'
import type { OnboardingRole } from '@/lib/auth/onboardingRole'
import { ONBOARDING_INTERESTS } from '@/lib/onboarding/interests'
import { cn } from '@/lib/utils'

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-amber-gold text-brand-black font-body font-bold text-sm hover:bg-light-gold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? 'Saving…' : label}
      {!pending && <ChevronRight className="size-4" aria-hidden="true" />}
    </button>
  )
}

interface CityOption {
  slug: string
  name: string
}

interface OnboardingFlowProps {
  cities: CityOption[]
  /**
   * The role the user picked at sign-up, normalized by the page. Used only when
   * the URL carries no ?role= — auth-callback lands here with a bare path, so
   * this is the ordinary case, not the fallback.
   */
  savedRole?: OnboardingRole
}

export function OnboardingFlow({ cities, savedRole }: OnboardingFlowProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const roleParam = searchParams.get('role') ?? savedRole ?? 'supporter'
  const next = searchParams.get('next') ?? ''
  const action = searchParams.get('action') ?? ''
  const listingId = searchParams.get('listing_id') ?? ''

  const isOwner = roleParam === 'owner'

  const [step, setStep] = useState(1)
  const [selectedCity, setSelectedCity] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const dbRole: 'supporter' | 'owner' = isOwner ? 'owner' : 'supporter'

  const [roleState, roleAction] = useActionState(setOnboardingRoleAction, null)

  function getPostOnboardingDestination() {
    if (next && next.startsWith('/')) return next
    if (isOwner) return '/claim'
    return '/account/saved'
  }

  // Every exit builds its form data here, so the city is always saved.
  // Interests are added only by "Get started".
  function buildFormData(interests: string[] = []) {
    const formData = new FormData()
    formData.set('role', dbRole)
    if (selectedCity) formData.set('city', selectedCity)
    for (const slug of interests) formData.append('interests', slug)
    return formData
  }

  function handleCitySkip() {
    setSelectedCity('')
    setStep(2)
  }

  function handleCityNext() {
    setStep(2)
  }

  function toggleCategory(cat: string) {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    )
  }

  async function handleFinalSubmit(overrideDest?: string) {
    // Best-effort: a failed save never blocks the redirect.
    await setOnboardingRoleAction(null, buildFormData()).catch(() => null)

    const dest = overrideDest ?? getPostOnboardingDestination()

    if (!overrideDest && action === 'save' && listingId && dest.startsWith('/')) {
      router.push(`${dest}?_save=${listingId}${next ? `&_from=${encodeURIComponent(next)}` : ''}`)
    } else {
      router.push(dest)
    }
  }

  return (
    <div className="min-h-screen bg-deep-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="font-headline text-2xl text-gold">The BLACQList</p>
          <p className="font-subhead text-sm text-white/50 mt-1">Step {step} of 2</p>
          {/* Progress bar */}
          {/* The role sits on the track, not the fill, and runs 0..2 so the
              value matches the bar: step 1 is half full, step 2 is full. */}
          <div
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={0}
            aria-valuemax={2}
            aria-valuetext={`Step ${step} of 2`}
            aria-label="Onboarding progress"
            className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden w-48 mx-auto"
          >
            <div
              aria-hidden="true"
              className="h-full bg-amber-gold rounded-full transition-all duration-300"
              style={{ width: step === 1 ? '50%' : '100%' }}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* ── Step 1: City ─────────────────────────────────────── */}
          {step === 1 && (
            <>
              <h1 className="font-headline text-[22px] text-brand-black mb-1">
                Where are you based?
              </h1>
              <p className="font-subhead text-sm text-charcoal mb-6">
                We&apos;ll show you relevant businesses nearby. You can change this later.
              </p>

              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="city"
                    className="font-subhead text-sm font-semibold text-brand-black"
                  >
                    Your city
                  </label>
                  <select
                    id="city"
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="h-11 rounded-lg border border-charcoal/30 bg-white font-subhead text-sm text-brand-black px-3 focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black"
                  >
                    <option value="">All cities / National</option>
                    {cities.map((city) => (
                      <option key={city.slug} value={city.slug}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <button
                    type="button"
                    onClick={handleCitySkip}
                    className="inline-flex min-h-11 items-center font-subhead text-sm text-charcoal-soft hover:text-charcoal underline underline-offset-2"
                  >
                    Skip for now
                  </button>
                  <button
                    type="button"
                    onClick={handleCityNext}
                    className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-amber-gold text-brand-black font-body font-bold text-sm hover:bg-light-gold transition-colors"
                  >
                    Next
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* ── Step 2A: Owner ───────────────────────────────────── */}
          {step === 2 && isOwner && (
            <>
              <h1 className="font-headline text-[22px] text-brand-black mb-1">
                Ready to get listed?
              </h1>
              <p className="font-subhead text-sm text-charcoal mb-6">
                Search for an existing listing to claim it, or add your business from scratch.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => void handleFinalSubmit('/claim')}
                  className="flex items-center gap-4 rounded-xl border border-charcoal/20 p-4 hover:border-brand-black hover:bg-pale-lavender/40 transition-colors cursor-pointer text-left"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pale-lavender flex items-center justify-center">
                    <Search className="size-5 text-brand-black" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-subhead text-sm font-semibold text-brand-black">
                      Search for my listing
                    </p>
                    <p className="font-subhead text-xs text-charcoal-soft">
                      Claim an existing BLACQList Page
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => void handleFinalSubmit('/add-business')}
                  className="flex items-center gap-4 rounded-xl border border-charcoal/20 p-4 hover:border-brand-black hover:bg-pale-lavender/40 transition-colors cursor-pointer text-left"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pale-lavender flex items-center justify-center">
                    <Store className="size-5 text-brand-black" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-subhead text-sm font-semibold text-brand-black">
                      Add my business
                    </p>
                    <p className="font-subhead text-xs text-charcoal-soft">
                      Create a new BLACQList Page
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => void handleFinalSubmit()}
                  className="min-h-11 font-subhead text-sm text-charcoal-soft hover:text-charcoal underline underline-offset-2 text-center mt-2"
                >
                  I&apos;ll do this later
                </button>
              </div>

              {roleState && 'error' in roleState && (
                <p role="alert" className="text-xs font-subhead text-red-600 mt-3 text-center">
                  {roleState.error}
                </p>
              )}
            </>
          )}

          {/* ── Step 2B: Supporter ───────────────────────────────── */}
          {step === 2 && !isOwner && (
            <>
              <h1 className="font-headline text-[22px] text-brand-black mb-1">
                What are you looking for?
              </h1>
              <p className="font-subhead text-sm text-charcoal mb-4">
                Select what interests you. We&apos;ll personalize your experience.
              </p>

              <div className="flex flex-wrap gap-2 mb-6">
                {ONBOARDING_INTERESTS.map(({ slug, label }) => {
                  const active = selectedCategories.includes(slug)
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => toggleCategory(slug)}
                      aria-pressed={active}
                      className={cn(
                        'min-h-11 px-4 py-1.5 rounded-full text-xs font-subhead font-semibold border transition-colors',
                        active
                          ? 'bg-brand-black text-white border-brand-black'
                          : 'bg-white text-charcoal border-charcoal/30 hover:border-charcoal/60'
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              <form
                action={async () => {
                  await Promise.resolve(roleAction(buildFormData(selectedCategories))).catch(
                    () => null
                  )
                  router.push(getPostOnboardingDestination())
                }}
                className="flex items-center justify-between"
              >
                <button
                  type="button"
                  onClick={() => {
                    void setOnboardingRoleAction(null, buildFormData())
                      .catch(() => null)
                      .then(() => router.push(getPostOnboardingDestination()))
                  }}
                  className="inline-flex min-h-11 items-center font-subhead text-sm text-charcoal-soft hover:text-charcoal underline underline-offset-2"
                >
                  Skip
                </button>
                <SubmitButton label="Get started" />
              </form>

              {roleState && 'error' in roleState && (
                <p role="alert" className="text-xs font-subhead text-red-600 mt-3 text-center">
                  {roleState.error}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
