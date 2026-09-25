'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { createListingAction } from '@/lib/actions/listings/createListing'
import {
  JOB_EMPLOYMENT_TYPES,
  JOB_EMPLOYMENT_TYPE_META,
  JOB_WORKPLACE_TYPES,
  JOB_WORKPLACE_TYPE_META,
  JOB_SALARY_PERIODS,
  JOB_SALARY_PERIOD_META,
  VALID_OWNERSHIP_LABELS,
  OWNERSHIP_LABEL_META,
} from '@/lib/constants/listing'
import { groupCategoriesByParent } from '@/lib/categories/sort'
import { cn } from '@/lib/utils'
import type { CategoryOption } from '@/app/add-business/page'

interface Props {
  categories: CategoryOption[]
}

export function SubmitJobForm({ categories }: Props) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(createListingAction, null)
  // Remote roles have no city to collect — the location block is hidden rather
  // than disabled so the form stays short on a phone.
  const [workplaceType, setWorkplaceType] = useState<string>('on-site')

  useEffect(() => {
    if (state && 'success' in state) {
      router.push(`/dashboard/pages/${state.listingId}/edit`)
    }
  }, [state, router])

  const fieldErr = (f: string) =>
    state && 'fieldErrors' in state ? state.fieldErrors?.[f] : undefined

  const inputCls = (f: string) =>
    cn(
      'h-11 w-full rounded-lg border bg-white font-subhead text-sm text-brand-black px-3',
      'placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black',
      fieldErr(f) ? 'border-red-400' : 'border-charcoal/30'
    )

  const labelCls = 'font-subhead text-sm font-semibold text-brand-black'
  const errCls = 'text-xs font-subhead text-red-600 mt-0.5'
  const optionalCls = 'font-normal text-charcoal-soft text-xs'

  return (
    <form
      action={formAction}
      className="bg-white rounded-2xl border border-charcoal/10 p-6 flex flex-col gap-5"
    >
      <input type="hidden" name="entity_type" value="job" />

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className={labelCls}>
          Job title <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          maxLength={120}
          required
          className={inputCls('name')}
          placeholder="e.g. Line Cook"
        />
        {fieldErr('name') && <p role="alert" className={errCls}>{fieldErr('name')}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tagline" className={labelCls}>
          Short description <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <input
          id="tagline"
          name="tagline"
          type="text"
          maxLength={120}
          required
          className={inputCls('tagline')}
          placeholder="One line shown on job cards (10–120 chars)"
        />
        {fieldErr('tagline') && <p role="alert" className={errCls}>{fieldErr('tagline')}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="category_id" className={labelCls}>
          Category <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <select
          id="category_id"
          name="category_id"
          required
          defaultValue=""
          className={cn(inputCls('category_id'), 'appearance-none cursor-pointer')}
        >
          <option value="" disabled>Select a category</option>
          {/* A to Z, each category grouped with its own subcategories. The parent
              itself stays selectable as the first entry in its group. */}
          {groupCategoriesByParent(categories).map(({ parent, children }) =>
            children.length === 0 ? (
              <option key={parent.id} value={parent.id}>{parent.name}</option>
            ) : (
              <optgroup key={parent.id} label={parent.name}>
                <option value={parent.id}>All {parent.name}</option>
                {children.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </optgroup>
            )
          )}
        </select>
        {fieldErr('category_id') && <p role="alert" className={errCls}>{fieldErr('category_id')}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="employment_type" className={labelCls}>
            Employment type <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <select
            id="employment_type"
            name="employment_type"
            required
            defaultValue=""
            className={cn(inputCls('employment_type'), 'appearance-none cursor-pointer')}
          >
            <option value="" disabled>Select one</option>
            {JOB_EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>{JOB_EMPLOYMENT_TYPE_META[t].label}</option>
            ))}
          </select>
          {fieldErr('employment_type') && (
            <p role="alert" className={errCls}>{fieldErr('employment_type')}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="workplace_type" className={labelCls}>
            Where the work happens <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <select
            id="workplace_type"
            name="workplace_type"
            required
            value={workplaceType}
            onChange={(e) => setWorkplaceType(e.target.value)}
            className={cn(inputCls('workplace_type'), 'appearance-none cursor-pointer')}
          >
            {JOB_WORKPLACE_TYPES.map((t) => (
              <option key={t} value={t}>{JOB_WORKPLACE_TYPE_META[t].label}</option>
            ))}
          </select>
          {fieldErr('workplace_type') && (
            <p role="alert" className={errCls}>{fieldErr('workplace_type')}</p>
          )}
        </div>
      </div>

      {workplaceType !== 'remote' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="city_text" className={labelCls}>City</label>
            <input
              id="city_text"
              name="city_text"
              type="text"
              className={inputCls('city_text')}
              placeholder="Atlanta"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="state_text" className={labelCls}>State</label>
            <input
              id="state_text"
              name="state_text"
              type="text"
              maxLength={2}
              className={inputCls('state_text')}
              placeholder="GA"
            />
          </div>
        </div>
      )}

      <fieldset className="flex flex-col gap-3 border-t border-charcoal/10 pt-5">
        <legend className={cn(labelCls, 'px-0')}>
          Pay <span className={optionalCls}>(optional, but postings with pay get more applicants)</span>
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="salary_min" className={labelCls}>Minimum</label>
            <input
              id="salary_min"
              name="salary_min"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className={inputCls('salary_min')}
              placeholder="20"
            />
            {fieldErr('salary_min') && (
              <p role="alert" className={errCls}>{fieldErr('salary_min')}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="salary_max" className={labelCls}>Maximum</label>
            <input
              id="salary_max"
              name="salary_max"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className={inputCls('salary_max')}
              placeholder="26"
            />
            {fieldErr('salary_max') && (
              <p role="alert" className={errCls}>{fieldErr('salary_max')}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="salary_period" className={labelCls}>Per</label>
            <select
              id="salary_period"
              name="salary_period"
              defaultValue=""
              className={cn(inputCls('salary_period'), 'appearance-none cursor-pointer')}
            >
              <option value="">—</option>
              {JOB_SALARY_PERIODS.map((p) => (
                <option key={p} value={p}>{JOB_SALARY_PERIOD_META[p].label}</option>
              ))}
            </select>
            {fieldErr('salary_period') && (
              <p role="alert" className={errCls}>{fieldErr('salary_period')}</p>
            )}
          </div>
        </div>
      </fieldset>

      {/* The `*` belongs on the legend, not on either input. createListing.ts
          requires ONE of these two, so marking a field required would be wrong
          on both counts: the browser would block a posting that supplied the
          other one, and a screen reader would announce a requirement the server
          does not have. The group is what is required. */}
      <fieldset className="flex flex-col gap-3 border-t border-charcoal/10 pt-5">
        <legend className={cn(labelCls, 'px-0')}>
          How people apply <span className="text-red-500" aria-hidden="true">*</span>
        </legend>
        <p className="font-subhead text-xs text-charcoal-soft">
          Add at least one. It becomes the Apply button on your posting.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="apply_url" className={labelCls}>
              Application link
            </label>
            <input
              id="apply_url"
              name="apply_url"
              type="url"
              className={inputCls('apply_url')}
              placeholder="https://…"
            />
            {fieldErr('apply_url') && <p role="alert" className={errCls}>{fieldErr('apply_url')}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="apply_email" className={labelCls}>
              Or an email to apply to
            </label>
            <input
              id="apply_email"
              name="apply_email"
              type="email"
              autoComplete="email"
              className={inputCls('apply_email')}
              placeholder="hiring@example.com"
            />
            {fieldErr('apply_email') && (
              <p role="alert" className={errCls}>{fieldErr('apply_email')}</p>
            )}
          </div>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1">
        <label htmlFor="closes_at" className={labelCls}>
          Applications close <span className={optionalCls}>(optional)</span>
        </label>
        <input id="closes_at" name="closes_at" type="date" className={inputCls('closes_at')} />
        {fieldErr('closes_at') && <p role="alert" className={errCls}>{fieldErr('closes_at')}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className={labelCls}>
          About this role <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={6}
          maxLength={2000}
          required
          className={cn(
            'w-full rounded-lg border bg-white font-subhead text-sm text-brand-black px-3 py-2.5 resize-none',
            'placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black',
            fieldErr('description') ? 'border-red-400' : 'border-charcoal/30'
          )}
          placeholder="What the role involves, who you're looking for, and what you offer. 20–2000 characters."
        />
        {fieldErr('description') && (
          <p role="alert" className={errCls}>{fieldErr('description')}</p>
        )}
      </div>

      <fieldset className="flex flex-col gap-2 border-t border-charcoal/10 pt-5">
        <legend className={cn(labelCls, 'px-0')}>
          The hiring business is <span className="text-red-500" aria-hidden="true">*</span>
        </legend>
        <div className="flex flex-wrap gap-4 pt-1">
          {VALID_OWNERSHIP_LABELS.map((value) => (
            <label key={value} className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="ownership_label"
                value={value}
                required
                className="h-4 w-4 border-charcoal/30 accent-brand-black"
              />
              <span className="font-subhead text-sm text-brand-black">
                {OWNERSHIP_LABEL_META[value].label}
              </span>
            </label>
          ))}
        </div>
        {fieldErr('ownership_label') && (
          <p role="alert" className={errCls}>{fieldErr('ownership_label')}</p>
        )}
      </fieldset>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="ownership_attested"
          value="true"
          required
          className="mt-0.5 h-4 w-4 rounded border-charcoal/30 accent-brand-black"
        />
        <span className="font-subhead text-xs text-charcoal leading-relaxed">
          This is a real open role, I am authorized to post it, and the ownership label above is
          accurate.
        </span>
      </label>

      {state && 'error' in state && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2"
        >
          <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
          <p className="font-subhead text-sm text-red-700">{state.error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 h-12 rounded-full bg-amber-gold text-brand-black font-subhead text-sm font-bold hover:bg-amber-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isPending ? 'Creating…' : 'Create job draft'}
      </button>
      <p className="font-subhead text-xs text-charcoal-soft text-center">
        You&apos;ll land on the job editor next, where you can add images and submit it for review.
      </p>
    </form>
  )
}
