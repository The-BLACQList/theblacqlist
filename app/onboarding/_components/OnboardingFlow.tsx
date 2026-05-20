"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, ChevronRight, Store, Search } from "lucide-react"

import { setOnboardingRoleAction } from "@/lib/actions/account/setOnboardingRole"
import { cn } from "@/lib/utils"

const CATEGORY_PILLS = [
  "Food & Dining",
  "Beauty & Grooming",
  "Fashion & Apparel",
  "Wellness & Health",
  "Professional Services",
  "Creative & Media",
  "Events & Entertainment",
  "Technology",
  "Education",
  "Retail & Gifts",
]

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-amber-gold text-brand-black font-body font-bold text-sm hover:bg-light-gold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? "Saving…" : label}
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
}

export function OnboardingFlow({ cities }: OnboardingFlowProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const roleParam = searchParams.get("role") ?? "supporter"
  const next = searchParams.get("next") ?? ""
  const action = searchParams.get("action") ?? ""
  const listingId = searchParams.get("listing_id") ?? ""

  const isOwner = roleParam === "owner"

  const [step, setStep] = useState(1)
  const [selectedCity, setSelectedCity] = useState("")
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  const dbRole: "supporter" | "owner" = isOwner ? "owner" : "supporter"

  const [roleState, roleAction] = useActionState(setOnboardingRoleAction, null)

  function getPostOnboardingDestination() {
    if (next && next.startsWith("/")) return next
    if (isOwner) return "/claim"
    return "/account/saved"
  }

  function handleCitySkip() {
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
    const formData = new FormData()
    formData.set("role", dbRole)

    // Fire role action — graceful no-op if schema not migrated yet
    await setOnboardingRoleAction(null, formData)

    const dest = overrideDest ?? getPostOnboardingDestination()

    if (!overrideDest && action === "save" && listingId && dest.startsWith("/")) {
      router.push(
        `${dest}?_save=${listingId}${next ? `&_from=${encodeURIComponent(next)}` : ""}`
      )
    } else {
      router.push(dest)
    }
  }

  return (
    <div className="min-h-screen bg-deep-bg flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="font-headline text-2xl text-amber-gold">The BLACQList</p>
          <p className="font-subhead text-sm text-white/50 mt-1">
            Step {step} of 2
          </p>
          {/* Progress bar */}
          <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden w-48 mx-auto">
            <div
              className="h-full bg-amber-gold rounded-full transition-all duration-300"
              style={{ width: step === 1 ? "50%" : "100%" }}
              role="progressbar"
              aria-valuenow={step}
              aria-valuemin={1}
              aria-valuemax={2}
              aria-label={`Onboarding step ${step} of 2`}
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
                We&apos;ll show you relevant businesses nearby. You can change
                this later.
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
                    className="font-subhead text-sm text-charcoal/60 hover:text-charcoal underline underline-offset-2"
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
                Search for an existing listing to claim it, or add your
                business from scratch.
              </p>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => void handleFinalSubmit("/claim")}
                  className="flex items-center gap-4 rounded-xl border border-charcoal/20 p-4 hover:border-brand-black hover:bg-pale-lavender/40 transition-colors cursor-pointer text-left"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pale-lavender flex items-center justify-center">
                    <Search className="size-5 text-brand-black" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-subhead text-sm font-semibold text-brand-black">
                      Search for my listing
                    </p>
                    <p className="font-subhead text-xs text-charcoal/60">
                      Claim an existing BLACQList Page
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => void handleFinalSubmit("/add-business")}
                  className="flex items-center gap-4 rounded-xl border border-charcoal/20 p-4 hover:border-brand-black hover:bg-pale-lavender/40 transition-colors cursor-pointer text-left"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pale-lavender flex items-center justify-center">
                    <Store className="size-5 text-brand-black" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-subhead text-sm font-semibold text-brand-black">
                      Add my business
                    </p>
                    <p className="font-subhead text-xs text-charcoal/60">
                      Create a new BLACQList Page
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => void handleFinalSubmit()}
                  className="font-subhead text-sm text-charcoal/60 hover:text-charcoal underline underline-offset-2 text-center mt-2"
                >
                  I&apos;ll do this later
                </button>
              </div>

              {roleState && "error" in roleState && (
                <p
                  role="alert"
                  className="text-xs font-subhead text-red-600 mt-3 text-center"
                >
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
                Select what interests you. We&apos;ll personalize your
                experience.
              </p>

              <div className="flex flex-wrap gap-2 mb-6">
                {CATEGORY_PILLS.map((cat) => {
                  const active = selectedCategories.includes(cat)
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      aria-pressed={active}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-subhead font-semibold border transition-colors",
                        active
                          ? "bg-brand-black text-white border-brand-black"
                          : "bg-white text-charcoal border-charcoal/30 hover:border-charcoal/60"
                      )}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>

              <form
                action={async () => {
                  const formData = new FormData()
                  formData.set("role", dbRole)
                  await roleAction(formData)
                  router.push(getPostOnboardingDestination())
                }}
                className="flex items-center justify-between"
              >
                <button
                  type="button"
                  onClick={() => {
                    const formData = new FormData()
                    formData.set("role", dbRole)
                    void setOnboardingRoleAction(null, formData).then(() =>
                      router.push(getPostOnboardingDestination())
                    )
                  }}
                  className="font-subhead text-sm text-charcoal/60 hover:text-charcoal underline underline-offset-2"
                >
                  Skip
                </button>
                <SubmitButton label="Get started" />
              </form>

              {roleState && "error" in roleState && (
                <p
                  role="alert"
                  className="text-xs font-subhead text-red-600 mt-3 text-center"
                >
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
