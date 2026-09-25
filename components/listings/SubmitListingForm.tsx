'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { byName } from '@/lib/categories/sort'
import { cn } from '@/lib/utils'
import { MediaStep } from '@/app/add-business/_components/steps/MediaStep'
import { CtaStep } from '@/app/add-business/_components/steps/CtaStep'
import { PreviewPublishStep } from '@/app/add-business/_components/steps/PreviewPublishStep'
import type { CategoryOption } from '@/app/add-business/page'
import {
  VALID_ENTITY_TYPES,
  VALID_LOCATION_TYPES,
  VALID_CTA_TYPES,
  VALID_OWNERSHIP_LABELS,
} from '@/lib/constants/listing'

const DRAFT_KEY = 'draft-add-business'

// These option values MUST match the live DB CHECK constraints
// (migration 20260524000001 + 20260622000007) — see lib/constants/listing.ts.
const ENTITY_TYPE_OPTIONS = [
  { value: 'business', label: 'Business' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'service_provider', label: 'Service Provider' },
  { value: 'creative', label: 'Creative' },
  { value: 'professional', label: 'Professional' },
  { value: 'vendor', label: 'Vendor' },
]

const LOCATION_TYPE_OPTIONS = [
  { value: 'physical', label: 'Physical location' },
  { value: 'virtual', label: 'Online / virtual' },
  { value: 'hybrid', label: 'Physical + online' },
  { value: 'service_area', label: 'Service area' },
  { value: 'national', label: 'Nationwide' },
  { value: 'traveling', label: 'Traveling / mobile' },
]

const CTA_TYPE_OPTIONS = [
  { value: 'book', label: 'Book an appointment' },
  { value: 'order', label: 'Order online' },
  { value: 'call', label: 'Call us' },
  { value: 'message', label: 'Send a message' },
  { value: 'visit', label: 'Visit us' },
  { value: 'get-quote', label: 'Get a quote' },
  { value: 'shop', label: 'Shop now' },
  { value: 'subscribe', label: 'Subscribe' },
  { value: 'contact', label: 'Contact us' },
  { value: 'commission', label: 'Commission work' },
  { value: 'inquire', label: 'Make an inquiry' },
  { value: 'get-tickets', label: 'Get tickets' },
  { value: 'rsvp', label: 'RSVP' },
  { value: 'register', label: 'Register' },
  { value: 'learn-more', label: 'Learn more' },
  { value: 'apply', label: 'Apply now' },
  { value: 'buy-now', label: 'Buy now' },
]

type SocialKey =
  | 'social_instagram'
  | 'social_facebook'
  | 'social_twitter'
  | 'social_tiktok'
  | 'social_linkedin'
  | 'social_youtube'

const SOCIAL_FIELDS: [SocialKey, string][] = [
  ['social_instagram', 'Instagram'],
  ['social_facebook', 'Facebook'],
  ['social_twitter', 'X / Twitter'],
  ['social_tiktok', 'TikTok'],
  ['social_linkedin', 'LinkedIn'],
  ['social_youtube', 'YouTube'],
]

const STEP_TITLES = [
  'About your business',
  'Where you operate',
  'How to reach you',
  'Your story',
  'Add photos',
  'Primary action',
  'Preview & publish',
]

const CTA_STEP6_VALUES = ['book', 'order', 'call', 'visit', 'message']

interface FormFields {
  ownership_label: string
  entity_type: string
  name: string
  tagline: string
  parent_category_id: string
  category_id: string
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
}

const INITIAL: FormFields = {
  ownership_label: '',
  entity_type: '',
  name: '',
  tagline: '',
  parent_category_id: '',
  category_id: '',
  location_type: '',
  city_text: '',
  state_text: '',
  service_area_description: '',
  ships_nationwide: false,
  website_url: '',
  email: '',
  phone: '',
  cta_type: '',
  cta_url: '',
  social_instagram: '',
  social_facebook: '',
  social_twitter: '',
  social_tiktok: '',
  social_linkedin: '',
  social_youtube: '',
  description: '',
  founder_story: '',
}

interface Props {
  categories: CategoryOption[]
}

export function SubmitListingForm({ categories }: Props) {
  const router = useRouter()
  const [step, setStep] = useState(0)

  const [fields, setFields] = useState<FormFields>(INITIAL)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FormFields>
        // Drop persisted enum values no longer offered (e.g. after a DB constraint
        // change) so a stale draft can't resubmit a value the database now rejects.
        if (parsed.entity_type && !(VALID_ENTITY_TYPES as readonly string[]).includes(parsed.entity_type))
          parsed.entity_type = ''
        if (parsed.ownership_label && !(VALID_OWNERSHIP_LABELS as readonly string[]).includes(parsed.ownership_label))
          parsed.ownership_label = ''
        if (parsed.location_type && !(VALID_LOCATION_TYPES as readonly string[]).includes(parsed.location_type))
          parsed.location_type = ''
        if (parsed.cta_type && !(VALID_CTA_TYPES as readonly string[]).includes(parsed.cta_type))
          parsed.cta_type = ''
        // Safe: runs once on mount to hydrate draft from localStorage — avoids SSR mismatch
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFields({ ...INITIAL, ...parsed })
      }
    } catch {
      // ignore corrupt draft
    }
  }, [])

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Media upload state (not persisted to localStorage)
  const [tempEntityId] = useState(() => crypto.randomUUID())
  const [logoCdnUrl, setLogoCdnUrl] = useState<string | null>(null)
  const [coverCdnUrl, setCoverCdnUrl] = useState<string | null>(null)
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [coverImagePath, setCoverImagePath] = useState<string | null>(null)
  const [galleryPaths, setGalleryPaths] = useState<string[]>([])

  function set<K extends keyof FormFields>(key: K, val: FormFields[K]) {
    setFields((prev) => {
      const next: FormFields = { ...prev }
      next[key] = val
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
    setErrors((prev) => {
      const k = String(key)
      if (!(k in prev)) return prev
      const next = { ...prev }
      delete next[k]
      return next
    })
  }

  function setCtaFields(type: string, url: string) {
    setFields((prev) => {
      const next = { ...prev, cta_type: type, cta_url: url }
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
    setErrors((prev) => {
      const next = { ...prev }
      delete next.cta_type
      delete next.cta_url
      return next
    })
  }

  // A to Z for the owner. display_order is a curation order for the public site,
  // not a lookup order for someone hunting for their own category.
  const parentCategories = categories.filter((c) => c.parent_id === null).sort(byName)
  const subcategories = fields.parent_category_id
    ? categories.filter((c) => c.parent_id === fields.parent_category_id).sort(byName)
    : []

  function onParentCategory(id: string) {
    const hasSubs = categories.some((c) => c.parent_id === id)
    setFields((prev) => {
      const next: FormFields = { ...prev, parent_category_id: id, category_id: hasSubs ? '' : id }
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
    setErrors((prev) => {
      const next = { ...prev }
      delete next.category_id
      return next
    })
  }

  function validate(s: number): Record<string, string> {
    const e: Record<string, string> = {}
    if (s === 1) {
      if (!fields.entity_type) e.entity_type = 'Select a listing type.'
      if (fields.name.trim().length < 2) e.name = 'Name must be at least 2 characters.'
      if (fields.tagline.trim().length < 10)
        e.tagline = 'Short description must be at least 10 characters.'
      if (!fields.category_id)
        e.category_id = subcategories.length > 0 ? 'Select a subcategory.' : 'Select a category.'
    } else if (s === 2) {
      if (!fields.location_type) e.location_type = 'Select where you operate.'
    } else if (s === 3) {
      if (!fields.cta_type) e.cta_type = 'Select a primary action.'
    } else if (s === 4) {
      if (fields.description.trim().length < 20)
        e.description = 'Description must be at least 20 characters.'
    } else if (s === 6) {
      if (!CTA_STEP6_VALUES.includes(fields.cta_type)) {
        e.cta_step6 = 'Select how customers should reach you.'
      }
    }
    return e
  }

  function goNext() {
    const e = validate(step)
    if (Object.keys(e).length) {
      setErrors(e)
      return
    }
    setErrors({})
    setStep((s) => s + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goBack() {
    setErrors({})
    setStep((s) => s - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Jump directly to a step (used by the preview step's error summary so a
  // visitor can click an error and land on the field that needs fixing).
  function goToStep(s: number) {
    setErrors({})
    setStep(s)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function onPublishSuccess(listingName: string) {
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {}
    const isDraft = listingName.endsWith(' (draft)')
    const name = listingName.replace(/ \(draft\)$/, '')
    const qs = isDraft
      ? `?name=${encodeURIComponent(name)}&type=draft`
      : `?name=${encodeURIComponent(name)}`
    router.push(`/add-business/submitted${qs}`)
  }

  const err = (f: string) => errors[f] as string | undefined

  const inputCls = (f: string) =>
    cn(
      'h-11 w-full rounded-lg border bg-white font-subhead text-sm text-brand-black px-3',
      'placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black',
      err(f) ? 'border-red-400' : 'border-charcoal/30'
    )

  const textareaCls = (f: string) =>
    cn(
      'w-full rounded-lg border bg-white font-subhead text-sm text-brand-black px-3 py-2.5 resize-none',
      'placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black',
      err(f) ? 'border-red-400' : 'border-charcoal/30'
    )

  const selectCls = (f: string, hasValue: boolean) =>
    cn(
      'h-11 w-full rounded-lg border bg-white font-subhead text-sm px-3',
      'focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black',
      'appearance-none cursor-pointer',
      hasValue ? 'text-brand-black' : 'text-charcoal-faint',
      err(f) ? 'border-red-400' : 'border-charcoal/30'
    )

  const showCityState = fields.location_type === 'physical' || fields.location_type === 'hybrid'
  const showServiceArea = fields.location_type === 'service_area'

  const isStep6Valid = CTA_STEP6_VALUES.includes(fields.cta_type)

  const categoryName = categories.find((c) => c.id === fields.category_id)?.name ?? ''

  return (
    <div>
      {/* Step 0 — Ownership label (Black-Owned / Ally) */}
      {step === 0 && (
        <div className="bg-white rounded-2xl border border-charcoal/10 p-6 flex flex-col gap-6">
          <div>
            <p className="font-subhead text-xs font-semibold uppercase tracking-widest text-amber mb-2">
              Before you start
            </p>
            <h2 className="font-headline text-2xl text-brand-black mb-3">
              Which best describes your business?
            </h2>
            <p className="font-subhead text-sm text-charcoal leading-relaxed">
              The BLACQList centers and elevates Black-owned businesses. Businesses that support the
              community are welcome too. Every listing is clearly labeled so shoppers know exactly
              who they&apos;re supporting.
            </p>
          </div>

          {/* Ownership choice */}
          <div
            role="group"
            aria-label="Business ownership"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {[
              {
                value: 'black_owned',
                title: 'Black-Owned',
                desc: 'Majority (51%+) Black-owned and operated.',
              },
              {
                value: 'ally',
                title: 'Ally',
                desc: 'Not Black-owned, but supports Black-owned businesses.',
              },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={fields.ownership_label === opt.value}
                onClick={() => set('ownership_label', opt.value)}
                className={cn(
                  'rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2',
                  fields.ownership_label === opt.value
                    ? 'border-brand-black bg-brand-black text-white'
                    : 'border-charcoal/20 bg-white text-charcoal hover:border-charcoal/50 hover:text-brand-black'
                )}
              >
                <span className="block font-subhead text-base font-bold">{opt.title}</span>
                <span
                  className={cn(
                    'block font-subhead text-xs mt-1',
                    fields.ownership_label === opt.value ? 'text-white/80' : 'text-charcoal-soft'
                  )}
                >
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>

          {/* Branch-specific criteria */}
          {fields.ownership_label && (
            <div className="flex flex-col gap-2">
              {(fields.ownership_label === 'black_owned'
                ? [
                    'Majority Black-owned: at least 51% Black or African American ownership',
                    'Operational control: Black owner(s) actively manage the business',
                    'Currently operating, not closed or inactive',
                  ]
                : [
                    'You support Black-owned businesses and the community',
                    'Your listing will be clearly labeled “Ally”',
                    'Currently operating, not closed or inactive',
                  ]
              ).map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-gold/15">
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                      <path d="M1 4l2.5 2.5L9 1" stroke="#C4A065" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="font-subhead text-sm text-charcoal">{item}</p>
                </div>
              ))}
            </div>
          )}

          <p className="font-subhead text-xs text-charcoal-soft leading-relaxed">
            You&apos;ll confirm this on the final step. Submissions are reviewed by our team before
            going live. See our{' '}
            <a
              href="/terms#business-listings"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber hover:underline"
            >
              Terms of Service
            </a>{' '}
            for the full definition.
          </p>

          <button
            type="button"
            onClick={() => setStep(1)}
            disabled={!fields.ownership_label}
            className="h-12 w-full rounded-full bg-amber-gold text-brand-black font-subhead text-sm font-bold hover:bg-amber-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold focus-visible:ring-offset-2"
          >
            Continue
          </button>
        </div>
      )}

      {/* Step indicator — only shown once form has started */}
      {step >= 1 && (
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="font-subhead text-xs font-semibold uppercase tracking-widest text-amber mb-0.5">
            Step {step} of 7
          </p>
          <p className="font-subhead text-sm font-medium text-charcoal">{STEP_TITLES[step - 1]}</p>
        </div>
        <div className="flex items-center gap-1.5" role="group" aria-label="Form progress">
          {[1, 2, 3, 4, 5, 6, 7].map((s) => (
            <div
              key={s}
              aria-label={`Step ${s}${s < step ? ' complete' : s === step ? ' current' : ''}`}
              className={cn(
                'h-2 rounded-full transition-all',
                s === step
                  ? 'w-5 bg-brand-black'
                  : s < step
                    ? 'w-2 bg-amber-gold'
                    : 'w-2 bg-charcoal/20'
              )}
            />
          ))}
        </div>
      </div>
      )}

      {/* Step 1 — About your business */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-charcoal/10 p-6 flex flex-col gap-5">
          {/* Entity type */}
          <div className="flex flex-col gap-2">
            <p className="font-subhead text-sm font-semibold text-brand-black">
              What best describes your listing?
              <span className="text-red-500 ml-0.5" aria-hidden="true">
                *
              </span>
            </p>
            <div
              role="group"
              aria-label="Listing type"
              aria-describedby={err('entity_type') ? 'entity_type-error' : undefined}
              className="grid grid-cols-2 sm:grid-cols-3 gap-2"
            >
              {ENTITY_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={fields.entity_type === opt.value}
                  onClick={() => set('entity_type', opt.value)}
                  className={cn(
                    'h-11 rounded-lg border font-subhead text-sm transition-colors',
                    fields.entity_type === opt.value
                      ? 'border-brand-black bg-brand-black text-white'
                      : 'border-charcoal/20 bg-white text-charcoal hover:border-charcoal/50 hover:text-brand-black'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {err('entity_type') && (
              <p id="entity_type-error" role="alert" className="text-xs font-subhead text-red-600">
                {err('entity_type')}
              </p>
            )}
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="font-subhead text-sm font-semibold text-brand-black">
              Business name
              <span className="text-red-500 ml-0.5" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id="name"
              type="text"
              autoComplete="organization"
              maxLength={120}
              value={fields.name}
              onChange={(e) => set('name', e.target.value)}
              aria-describedby={err('name') ? 'name-error' : undefined}
              aria-invalid={!!err('name')}
              className={inputCls('name')}
              placeholder="Your business or brand name"
            />
            {err('name') && (
              <p id="name-error" role="alert" className="text-xs font-subhead text-red-600 mt-0.5">
                {err('name')}
              </p>
            )}
          </div>

          {/* Tagline */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="tagline"
                className="font-subhead text-sm font-semibold text-brand-black"
              >
                Short description
                <span className="text-red-500 ml-0.5" aria-hidden="true">
                  *
                </span>
              </label>
              <span className="text-xs font-subhead text-charcoal-faint" aria-hidden="true">
                {fields.tagline.length}/120
              </span>
            </div>
            <input
              id="tagline"
              type="text"
              maxLength={120}
              value={fields.tagline}
              onChange={(e) => set('tagline', e.target.value)}
              aria-describedby={cn('tagline-hint', err('tagline') ? 'tagline-error' : undefined)}
              aria-invalid={!!err('tagline')}
              className={inputCls('tagline')}
              placeholder="What you do in one line"
            />
            <p id="tagline-hint" className="text-xs font-subhead text-charcoal-faint">
              Shown on directory cards. 10–120 characters.
            </p>
            {err('tagline') && (
              <p
                id="tagline-error"
                role="alert"
                className="text-xs font-subhead text-red-600 mt-0.5"
              >
                {err('tagline')}
              </p>
            )}
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="parent_category"
              className="font-subhead text-sm font-semibold text-brand-black"
            >
              Category
              <span className="text-red-500 ml-0.5" aria-hidden="true">
                *
              </span>
            </label>
            <select
              id="parent_category"
              value={fields.parent_category_id}
              onChange={(e) => onParentCategory(e.target.value)}
              className={selectCls(
                subcategories.length === 0 ? 'category_id' : '__parent_only',
                !!fields.parent_category_id
              )}
            >
              <option value="" disabled>
                Select a category
              </option>
              {parentCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {err('category_id') && subcategories.length === 0 && (
              <p
                id="category_id-error"
                role="alert"
                className="text-xs font-subhead text-red-600 mt-0.5"
              >
                {err('category_id')}
              </p>
            )}
          </div>

          {/* Subcategory */}
          {subcategories.length > 0 && (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="subcategory"
                className="font-subhead text-sm font-semibold text-brand-black"
              >
                Subcategory
                <span className="text-red-500 ml-0.5" aria-hidden="true">
                  *
                </span>
              </label>
              <select
                id="subcategory"
                value={fields.category_id}
                onChange={(e) => set('category_id', e.target.value)}
                aria-describedby={err('category_id') ? 'category_id-error' : undefined}
                aria-invalid={!!err('category_id')}
                className={selectCls('category_id', !!fields.category_id)}
              >
                <option value="" disabled>
                  Select a subcategory
                </option>
                {subcategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {err('category_id') && (
                <p
                  id="category_id-error"
                  role="alert"
                  className="text-xs font-subhead text-red-600 mt-0.5"
                >
                  {err('category_id')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Step 2 — Where you operate */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-charcoal/10 p-6 flex flex-col gap-5">
          {/* Location type */}
          <div className="flex flex-col gap-2">
            <p className="font-subhead text-sm font-semibold text-brand-black">
              Where do you operate?
              <span className="text-red-500 ml-0.5" aria-hidden="true">
                *
              </span>
            </p>
            <div
              role="group"
              aria-label="Location type"
              aria-describedby={err('location_type') ? 'location_type-error' : undefined}
              className="grid grid-cols-2 sm:grid-cols-3 gap-2"
            >
              {LOCATION_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={fields.location_type === opt.value}
                  onClick={() => set('location_type', opt.value)}
                  className={cn(
                    'h-11 rounded-lg border font-subhead text-sm transition-colors',
                    fields.location_type === opt.value
                      ? 'border-brand-black bg-brand-black text-white'
                      : 'border-charcoal/20 bg-white text-charcoal hover:border-charcoal/50 hover:text-brand-black'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {err('location_type') && (
              <p
                id="location_type-error"
                role="alert"
                className="text-xs font-subhead text-red-600"
              >
                {err('location_type')}
              </p>
            )}
          </div>

          {/* City + State */}
          {showCityState && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="city_text"
                  className="font-subhead text-sm font-semibold text-brand-black"
                >
                  City
                </label>
                <input
                  id="city_text"
                  type="text"
                  value={fields.city_text}
                  onChange={(e) => set('city_text', e.target.value)}
                  className={inputCls('city_text')}
                  placeholder="Atlanta"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="state_text"
                  className="font-subhead text-sm font-semibold text-brand-black"
                >
                  State
                </label>
                <input
                  id="state_text"
                  type="text"
                  maxLength={2}
                  value={fields.state_text}
                  onChange={(e) => set('state_text', e.target.value.toUpperCase())}
                  className={inputCls('state_text')}
                  placeholder="GA"
                />
              </div>
            </div>
          )}

          {/* Service area */}
          {showServiceArea && (
            <div className="flex flex-col gap-1">
              <label
                htmlFor="service_area_description"
                className="font-subhead text-sm font-semibold text-brand-black"
              >
                Service area
              </label>
              <input
                id="service_area_description"
                type="text"
                value={fields.service_area_description}
                onChange={(e) => set('service_area_description', e.target.value)}
                className={inputCls('service_area_description')}
                placeholder="e.g. Greater Atlanta, Metro DC area"
              />
            </div>
          )}

          {/* Ships nationwide */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              id="ships_nationwide"
              checked={fields.ships_nationwide}
              onChange={(e) => set('ships_nationwide', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-charcoal/30 accent-brand-black"
            />
            <div>
              <span className="font-subhead text-sm font-semibold text-brand-black">
                Ships or delivers nationwide
              </span>
              <p className="font-subhead text-xs text-charcoal-soft mt-0.5">
                Check if you ship products or offer services across the U.S.
              </p>
            </div>
          </label>
        </div>
      )}

      {/* Step 3 — How to reach you */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-charcoal/10 p-6 flex flex-col gap-5">
          {/* CTA type */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="cta_type"
              className="font-subhead text-sm font-semibold text-brand-black"
            >
              Primary action
              <span className="text-red-500 ml-0.5" aria-hidden="true">
                *
              </span>
            </label>
            <p className="font-subhead text-xs text-charcoal-soft -mt-0.5 mb-0.5">
              What should someone do when they find your listing?
            </p>
            <select
              id="cta_type"
              value={fields.cta_type}
              onChange={(e) => set('cta_type', e.target.value)}
              aria-describedby={err('cta_type') ? 'cta_type-error' : undefined}
              aria-invalid={!!err('cta_type')}
              className={selectCls('cta_type', !!fields.cta_type)}
            >
              <option value="" disabled>
                Select a primary action
              </option>
              {CTA_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {err('cta_type') && (
              <p
                id="cta_type-error"
                role="alert"
                className="text-xs font-subhead text-red-600 mt-0.5"
              >
                {err('cta_type')}
              </p>
            )}
          </div>

          {/* CTA URL */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="cta_url"
              className="font-subhead text-sm font-semibold text-brand-black"
            >
              Link for that action
            </label>
            <input
              id="cta_url"
              type="url"
              value={fields.cta_url}
              onChange={(e) => set('cta_url', e.target.value)}
              aria-describedby={err('cta_url') ? 'cta_url-error' : 'cta_url-hint'}
              aria-invalid={!!err('cta_url')}
              className={inputCls('cta_url')}
              placeholder="https://yourbusiness.com/book"
            />
            {err('cta_url') ? (
              <p
                id="cta_url-error"
                role="alert"
                className="text-xs font-subhead text-red-600 mt-0.5"
              >
                {err('cta_url')}
              </p>
            ) : (
              <p id="cta_url-hint" className="text-xs font-subhead text-charcoal-faint">
                Optional. Must start with https://
              </p>
            )}
          </div>

          {/* Website */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="website_url"
              className="font-subhead text-sm font-semibold text-brand-black"
            >
              Website
            </label>
            <input
              id="website_url"
              type="url"
              autoComplete="url"
              value={fields.website_url}
              onChange={(e) => set('website_url', e.target.value)}
              aria-describedby={err('website_url') ? 'website_url-error' : undefined}
              aria-invalid={!!err('website_url')}
              className={inputCls('website_url')}
              placeholder="https://yourbusiness.com"
            />
            {err('website_url') && (
              <p
                id="website_url-error"
                role="alert"
                className="text-xs font-subhead text-red-600 mt-0.5"
              >
                {err('website_url')}
              </p>
            )}
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="email"
                className="font-subhead text-sm font-semibold text-brand-black"
              >
                Contact email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={fields.email}
                onChange={(e) => set('email', e.target.value)}
                aria-describedby={err('email') ? 'email-error' : undefined}
                aria-invalid={!!err('email')}
                className={inputCls('email')}
                placeholder="hello@yourbusiness.com"
              />
              {err('email') && (
                <p
                  id="email-error"
                  role="alert"
                  className="text-xs font-subhead text-red-600 mt-0.5"
                >
                  {err('email')}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="phone"
                className="font-subhead text-sm font-semibold text-brand-black"
              >
                Phone number
              </label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={fields.phone}
                onChange={(e) => set('phone', e.target.value)}
                className={inputCls('phone')}
                placeholder="(404) 555-0100"
              />
            </div>
          </div>

          {/* Social links */}
          <div>
            <p className="font-subhead text-sm font-semibold text-brand-black mb-3">
              Social links
              <span className="font-normal text-charcoal-soft ml-1.5 text-xs">(optional)</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SOCIAL_FIELDS.map(([key, label]) => (
                <div key={key} className="flex flex-col gap-1">
                  <label
                    htmlFor={key}
                    className="font-subhead text-xs font-semibold text-charcoal-soft"
                  >
                    {label}
                  </label>
                  <input
                    id={key}
                    type="url"
                    value={fields[key]}
                    onChange={(e) => set(key, e.target.value)}
                    aria-describedby={err(key) ? `${key}-error` : undefined}
                    aria-invalid={!!err(key)}
                    className={inputCls(key)}
                    placeholder="https://"
                  />
                  {err(key) && (
                    <p
                      id={`${key}-error`}
                      role="alert"
                      className="text-xs font-subhead text-red-600"
                    >
                      {err(key)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 4 — Your story */}
      {step === 4 && (
        <div className="bg-white rounded-2xl border border-charcoal/10 p-6 flex flex-col gap-5">
          {/* Description */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label
                htmlFor="description"
                className="font-subhead text-sm font-semibold text-brand-black"
              >
                About your business
                <span className="text-red-500 ml-0.5" aria-hidden="true">
                  *
                </span>
              </label>
              <span className="text-xs font-subhead text-charcoal-faint" aria-hidden="true">
                {fields.description.length}/2000
              </span>
            </div>
            <textarea
              id="description"
              rows={6}
              maxLength={2000}
              value={fields.description}
              onChange={(e) => set('description', e.target.value)}
              aria-describedby={cn(
                'description-hint',
                err('description') ? 'description-error' : undefined
              )}
              aria-invalid={!!err('description')}
              className={textareaCls('description')}
              placeholder="Tell people what makes your business unique, what you offer, and who you serve."
            />
            <p id="description-hint" className="text-xs font-subhead text-charcoal-faint">
              20–2000 characters. Shown on your full listing page.
            </p>
            {err('description') && (
              <p
                id="description-error"
                role="alert"
                className="text-xs font-subhead text-red-600 mt-0.5"
              >
                {err('description')}
              </p>
            )}
          </div>

          {/* Founder story */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="founder_story"
              className="font-subhead text-sm font-semibold text-brand-black"
            >
              Founder story
              <span className="font-normal text-charcoal-soft ml-1.5 text-xs">(optional)</span>
            </label>
            <textarea
              id="founder_story"
              rows={4}
              value={fields.founder_story}
              onChange={(e) => set('founder_story', e.target.value)}
              className={textareaCls('founder_story')}
              placeholder="Share the story behind your business. Why you started, what drives you."
            />
          </div>

          <p className="text-xs font-subhead text-charcoal-faint">
            <span className="text-red-500">*</span> Required fields
          </p>
        </div>
      )}

      {/* Step 5 — Add photos */}
      {step === 5 && (
        <MediaStep
          tempEntityId={tempEntityId}
          logoCdnUrl={logoCdnUrl}
          coverCdnUrl={coverCdnUrl}
          galleryPaths={galleryPaths}
          onLogoChange={(path, cdnUrl) => {
            setLogoPath(path)
            setLogoCdnUrl(cdnUrl)
          }}
          onCoverChange={(path, cdnUrl) => {
            setCoverImagePath(path)
            setCoverCdnUrl(cdnUrl)
          }}
          onGalleryChange={setGalleryPaths}
        />
      )}

      {/* Step 6 — Primary action (visual cards) */}
      {step === 6 && (
        <CtaStep
          ctaType={fields.cta_type}
          ctaUrl={fields.cta_url}
          phone={fields.phone}
          email={fields.email}
          onChange={setCtaFields}
        />
      )}

      {/* Step 7 — Preview & publish */}
      {step === 7 && (
        <PreviewPublishStep
          snapshot={{
            tempEntityId,
            ownership_label: fields.ownership_label,
            entity_type: fields.entity_type,
            name: fields.name,
            tagline: fields.tagline,
            category_id: fields.category_id,
            categoryName,
            location_type: fields.location_type,
            city_text: fields.city_text,
            state_text: fields.state_text,
            service_area_description: fields.service_area_description,
            ships_nationwide: fields.ships_nationwide,
            website_url: fields.website_url,
            email: fields.email,
            phone: fields.phone,
            cta_type: fields.cta_type,
            cta_url: fields.cta_url,
            social_instagram: fields.social_instagram,
            social_facebook: fields.social_facebook,
            social_twitter: fields.social_twitter,
            social_tiktok: fields.social_tiktok,
            social_linkedin: fields.social_linkedin,
            social_youtube: fields.social_youtube,
            description: fields.description,
            founder_story: fields.founder_story,
            logo_path: logoPath,
            cover_image_path: coverImagePath,
            gallery_paths: galleryPaths,
            logoCdnUrl,
            coverCdnUrl,
          }}
          onSuccess={onPublishSuccess}
          onGoToStep={goToStep}
        />
      )}

      {/* Navigation — only shown after eligibility gate */}
      {step >= 1 && <div className="flex items-center justify-between mt-6">
        {step > 1 ? (
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1.5 font-subhead text-sm text-charcoal hover:text-brand-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2 rounded-sm"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Back
          </button>
        ) : (
          <div />
        )}

        {step < 7 && (
          <button
            type="button"
            onClick={goNext}
            disabled={step === 6 && !isStep6Valid}
            className="h-11 px-6 rounded-full bg-brand-black text-white font-subhead text-sm font-bold hover:bg-charcoal transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2"
          >
            Continue
          </button>
        )}
      </div>}
    </div>
  )
}
