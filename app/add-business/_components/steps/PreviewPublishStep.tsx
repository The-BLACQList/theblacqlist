'use client'

import { useState, useTransition } from 'react'
import { Loader2, Eye, Phone, Mail, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { createListingAction } from '@/lib/actions/listings/createListing'
import { submitListingForReviewAction } from '@/lib/actions/listings/submitListingForReview'
import { DuplicateWarningDialog } from '@/app/add-business/_components/DuplicateWarningDialog'
import { FullPagePreview } from '@/app/add-business/_components/FullPagePreview'

interface DuplicateResult {
  id: string
  name: string
  slug: string
  entity_type: string
  trust_tier: string
  match_score: number
  cover_image_url: string | null
  city: { name: string; slug: string } | null
}

export interface FormSnapshot {
  tempEntityId: string
  ownership_label: string
  entity_type: string
  name: string
  tagline: string
  category_id: string
  categoryName: string
  location_type: string
  city_text: string
  state_text: string
  service_area_description: string
  ships_nationwide: boolean
  website_url: string
  email: string
  phone: string
  cta_type: string
  cta_url: string
  social_instagram: string
  social_facebook: string
  social_twitter: string
  social_tiktok: string
  social_linkedin: string
  social_youtube: string
  description: string
  founder_story: string
  logo_path: string | null
  cover_image_path: string | null
  gallery_paths: string[]
  logoCdnUrl: string | null
  coverCdnUrl: string | null
}

interface Props {
  snapshot: FormSnapshot
  onSuccess: (listingName: string) => void
  /** Jump the parent form to a given step (1–7) — used by the error summary. */
  onGoToStep?: (step: number) => void
}

async function resolveCityId(cityText: string): Promise<string | null> {
  if (!cityText.trim()) return null
  const supabase = createClient()
  const { data } = await supabase
    .from('cities')
    .select('id')
    .ilike('name', cityText.trim())
    .eq('is_active', true)
    .maybeSingle()
  return data?.id ?? null
}

async function fetchDuplicates(name: string, cityId: string): Promise<DuplicateResult[]> {
  const res = await fetch('/api/listings/duplicate-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, city_id: cityId }),
  })
  if (!res.ok) return []
  const json = (await res.json()) as { data?: { duplicates: DuplicateResult[] } }
  return json.data?.duplicates ?? []
}

function buildFormData(snapshot: FormSnapshot): FormData {
  const fd = new FormData()
  fd.append('temp_entity_id', snapshot.tempEntityId)
  fd.append('ownership_label', snapshot.ownership_label)
  fd.append('entity_type', snapshot.entity_type)
  fd.append('name', snapshot.name.trim())
  fd.append('tagline', snapshot.tagline.trim())
  fd.append('category_id', snapshot.category_id)
  fd.append('location_type', snapshot.location_type)
  fd.append('city_text', snapshot.city_text.trim())
  fd.append('state_text', snapshot.state_text.trim())
  fd.append('service_area_description', snapshot.service_area_description.trim())
  fd.append('ships_nationwide', String(snapshot.ships_nationwide))
  fd.append('website_url', snapshot.website_url.trim())
  fd.append('email', snapshot.email.trim())
  fd.append('phone', snapshot.phone.trim())
  fd.append('cta_type', snapshot.cta_type)
  fd.append('cta_url', snapshot.cta_url.trim())
  fd.append('social_instagram', snapshot.social_instagram.trim())
  fd.append('social_facebook', snapshot.social_facebook.trim())
  fd.append('social_twitter', snapshot.social_twitter.trim())
  fd.append('social_tiktok', snapshot.social_tiktok.trim())
  fd.append('social_linkedin', snapshot.social_linkedin.trim())
  fd.append('social_youtube', snapshot.social_youtube.trim())
  fd.append('description', snapshot.description.trim())
  fd.append('founder_story', snapshot.founder_story.trim())
  if (snapshot.logo_path) fd.append('logo_path', snapshot.logo_path)
  if (snapshot.cover_image_path) fd.append('cover_image_path', snapshot.cover_image_path)
  return fd
}

// Maps a server fieldError key → a human label + the step (1-indexed) it lives on,
// so this final step can tell the user EXACTLY which field on which step to fix.
const FIELD_INFO: Record<string, { label: string; step: number }> = {
  ownership_label: { label: 'Business ownership (Black-Owned or Ally)', step: 0 },
  entity_type: { label: 'Listing type', step: 1 },
  name: { label: 'Business name', step: 1 },
  tagline: { label: 'Short description', step: 1 },
  category_id: { label: 'Category', step: 1 },
  location_type: { label: 'Where you operate', step: 2 },
  website_url: { label: 'Website', step: 3 },
  email: { label: 'Email', step: 3 },
  social_instagram: { label: 'Instagram link', step: 3 },
  social_facebook: { label: 'Facebook link', step: 3 },
  social_twitter: { label: 'X / Twitter link', step: 3 },
  social_tiktok: { label: 'TikTok link', step: 3 },
  social_linkedin: { label: 'LinkedIn link', step: 3 },
  social_youtube: { label: 'YouTube link', step: 3 },
  description: { label: 'About your business', step: 4 },
  cta_type: { label: 'Primary action', step: 6 },
  cta_url: { label: 'Action link', step: 6 },
}

export function PreviewPublishStep({ snapshot, onSuccess, onGoToStep }: Props) {
  const [isPublishPending, startPublishTransition] = useTransition()
  const [isDraftPending, startDraftTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>> | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateResult[] | null>(null)
  const [pendingPublish, setPendingPublish] = useState(false)
  const [ownershipAttested, setOwnershipAttested] = useState(false)
  const [showFullPreview, setShowFullPreview] = useState(false)

  // Show field-level errors (with their step) when the server returns them;
  // otherwise fall back to a single generic message.
  function showError(
    result: { error: string; fieldErrors?: Partial<Record<string, string>> } | null,
    fallback: string
  ) {
    if (result?.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
      setFieldErrors(result.fieldErrors)
      setServerError(null)
    } else {
      setFieldErrors(null)
      setServerError(result?.error ?? fallback)
    }
  }

  async function runPublish() {
    setServerError(null)
    setFieldErrors(null)
    const fd = buildFormData(snapshot)
    fd.append('ownership_attested', 'true')

    const createResult = await createListingAction(null, fd)

    if (!createResult || 'error' in createResult) {
      showError(createResult, 'Something went wrong. Please try again.')
      return
    }

    const reviewFd = new FormData()
    reviewFd.append('listing_id', createResult.listingId)
    const reviewResult = await submitListingForReviewAction(null, reviewFd)

    // Businesses are never charged per posting, so this branch should not fire
    // here. It is handled anyway rather than falling through to `onSuccess`,
    // which would tell the owner their listing was submitted when it was not.
    if (reviewResult && 'requiresPayment' in reviewResult) {
      window.location.href = reviewResult.checkoutUrl
      return
    }

    if (!reviewResult || 'error' in reviewResult) {
      setServerError(
        ('error' in (reviewResult ?? {})) && reviewResult
          ? reviewResult.error
          : 'Failed to submit for review. Please try again.'
      )
      return
    }

    onSuccess(snapshot.name)
  }

  async function handlePublish() {
    startPublishTransition(async () => {
      // Duplicate check
      const cityId = await resolveCityId(snapshot.city_text)
      if (cityId && snapshot.name.trim().length >= 2) {
        const dups = await fetchDuplicates(snapshot.name.trim(), cityId)
        if (dups.length > 0) {
          setDuplicates(dups)
          setPendingPublish(true)
          return
        }
      }
      await runPublish()
    })
  }

  async function handleDraftSave() {
    startDraftTransition(async () => {
      setServerError(null)
      setFieldErrors(null)
      const fd = buildFormData(snapshot)
      const result = await createListingAction(null, fd)
      if (!result || 'error' in result) {
        showError(result, 'Failed to save draft.')
        return
      }
      onSuccess(`${snapshot.name} (draft)`)
    })
  }

  function onDuplicateContinue() {
    setDuplicates(null)
    setPendingPublish(false)
    startPublishTransition(runPublish)
  }

  function onDuplicateCancel() {
    setDuplicates(null)
    setPendingPublish(false)
  }

  const hasCover = !!snapshot.coverCdnUrl
  const hasContact = snapshot.phone || snapshot.email || snapshot.website_url
  const ctaLabel =
    snapshot.cta_type === 'book'
      ? 'Book now'
      : snapshot.cta_type === 'order'
        ? 'Order online'
        : snapshot.cta_type === 'call'
          ? 'Call us'
          : snapshot.cta_type === 'visit'
            ? 'Visit us'
            : snapshot.cta_type === 'message'
              ? 'Send a message'
              : snapshot.cta_type || 'Get in touch'

  return (
    <>
      {duplicates && pendingPublish && (
        <DuplicateWarningDialog
          duplicates={duplicates}
          onContinue={onDuplicateContinue}
          onCancel={onDuplicateCancel}
        />
      )}

      {showFullPreview && (
        <FullPagePreview snapshot={snapshot} onClose={() => setShowFullPreview(false)} />
      )}

      <div className="flex flex-col gap-4">
        {/* Preview banner + full-page preview launcher */}
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Eye className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p className="font-subhead text-xs text-amber-800 font-medium">
              Preview: this is how your page will look to visitors.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowFullPreview(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 h-9 px-4 rounded-lg bg-brand-black text-white font-subhead text-xs font-bold hover:bg-charcoal transition-colors"
          >
            <Eye className="size-3.5" aria-hidden="true" />
            Preview full page
          </button>
        </div>

        {/* Preview card */}
        <div className="rounded-2xl border border-charcoal/10 overflow-hidden bg-white">
          {/* Cover */}
          <div
            className={cn(
              'relative w-full bg-gradient-to-br from-charcoal/60 to-brand-black',
              'h-[180px] sm:h-[220px]'
            )}
          >
            {hasCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={snapshot.coverCdnUrl!} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.65) 100%)',
              }}
              aria-hidden="true"
            />
            {snapshot.logoCdnUrl && (
              <div className="absolute top-4 left-4 h-12 w-12 rounded-full overflow-hidden border-2 border-white/50 bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={snapshot.logoCdnUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
              <p className="font-headline text-xl sm:text-2xl text-white leading-snug">
                {snapshot.name || 'Your business name'}
              </p>
              <p className="font-body text-xs text-white/75 line-clamp-2 mt-0.5">
                {snapshot.tagline || 'Your short description'}
              </p>
              <div className="mt-3">
                <span className="inline-flex h-9 items-center justify-center px-5 rounded-full bg-amber-gold text-brand-black font-subhead text-xs font-bold">
                  {ctaLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="px-4 py-4 flex flex-col gap-3">
            {snapshot.categoryName && (
              <div>
                <p className="font-subhead text-[10px] font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  Category
                </p>
                <span className="inline-flex items-center rounded-full border border-charcoal/20 px-2.5 py-0.5 font-subhead text-xs text-charcoal">
                  {snapshot.categoryName}
                </span>
              </div>
            )}

            {hasContact && (
              <div>
                <p className="font-subhead text-[10px] font-semibold uppercase tracking-wider text-charcoal-soft mb-1.5">
                  Contact
                </p>
                <div className="flex flex-col gap-1.5">
                  {snapshot.phone && (
                    <span className="inline-flex items-center gap-1.5 font-body text-xs text-charcoal">
                      <Phone className="size-3 text-amber flex-shrink-0" aria-hidden="true" />
                      {snapshot.phone}
                    </span>
                  )}
                  {snapshot.email && (
                    <span className="inline-flex items-center gap-1.5 font-body text-xs text-charcoal break-all">
                      <Mail className="size-3 text-amber flex-shrink-0" aria-hidden="true" />
                      {snapshot.email}
                    </span>
                  )}
                  {snapshot.website_url && (
                    <span className="inline-flex items-center gap-1.5 font-body text-xs text-charcoal break-all">
                      <Globe className="size-3 text-amber flex-shrink-0" aria-hidden="true" />
                      {snapshot.website_url.replace(/^https?:\/\/(www\.)?/, '')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {snapshot.description && (
              <div>
                <p className="font-subhead text-[10px] font-semibold uppercase tracking-wider text-charcoal-soft mb-1">
                  About
                </p>
                <p className="font-body text-xs text-charcoal leading-relaxed line-clamp-4">
                  {snapshot.description}
                </p>
              </div>
            )}
          </div>
        </div>

        {fieldErrors && Object.keys(fieldErrors).length > 0 && (
          <div role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
            <p className="font-subhead text-sm font-semibold text-red-800 mb-1.5">
              Please fix these before submitting:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              {Object.entries(fieldErrors).map(([key, msg]) => {
                const info = FIELD_INFO[key]
                return (
                  <li key={key} className="font-subhead text-sm text-red-700">
                    {info && onGoToStep ? (
                      <button
                        type="button"
                        onClick={() => onGoToStep(info.step)}
                        className="font-semibold underline decoration-red-400 underline-offset-2 hover:text-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded-sm"
                      >
                        {info.label} (Step {info.step})
                      </button>
                    ) : (
                      info && <span className="font-semibold">{info.label} (Step {info.step})</span>
                    )}
                    {info ? ': ' : ''}
                    {msg}
                  </li>
                )
              })}
            </ul>
            <p className="font-subhead text-xs text-red-600 mt-2">
              {onGoToStep ? 'Click an error to jump to that step and fix it.' : 'Use the Back button to return to the step above and fix it.'}
            </p>
          </div>
        )}

        {serverError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm font-subhead text-red-700"
          >
            {serverError}
          </div>
        )}

        {/* Ownership attestation — required before Submit for Review */}
        <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-charcoal/15 bg-white p-4">
          <input
            type="checkbox"
            checked={ownershipAttested}
            onChange={(e) => setOwnershipAttested(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-charcoal/30 accent-amber-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2"
            aria-describedby="attest-desc"
          />
          <span id="attest-desc" className="font-subhead text-xs text-charcoal leading-relaxed">
            {snapshot.ownership_label === 'ally' ? (
              <>
                I confirm this business supports Black-owned businesses and is not itself majority
                Black-owned (it will be labeled “Ally”), and all information I have submitted is
                accurate and truthful.
              </>
            ) : (
              <>
                I confirm this business is majority Black-owned (≥51% Black or African American
                ownership and operational control), and all information I have submitted is accurate
                and truthful.
              </>
            )}
          </span>
        </label>

        {/* Publish actions */}
        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishPending || isDraftPending || !ownershipAttested}
            className="h-12 w-full rounded-full bg-amber-gold text-brand-black font-subhead text-sm font-bold hover:bg-amber-gold/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2"
          >
            {isPublishPending && !pendingPublish && (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
            {isPublishPending && !pendingPublish ? 'Submitting…' : 'Submit for review'}
          </button>
          <button
            type="button"
            onClick={handleDraftSave}
            disabled={isPublishPending || isDraftPending}
            className="h-11 w-full rounded-full border border-charcoal/30 text-charcoal font-subhead text-sm font-semibold hover:border-charcoal/60 hover:text-brand-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2"
          >
            {isDraftPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
            {isDraftPending ? 'Saving…' : 'Save as draft'}
          </button>
          <p className="text-center font-subhead text-xs text-charcoal-faint">
            Drafts are only visible to you and won&apos;t appear in the directory.
          </p>
        </div>
      </div>
    </>
  )
}
