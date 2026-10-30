import Link from 'next/link'
import {
  JOB_EMPLOYMENT_TYPES,
  JOB_EMPLOYMENT_TYPE_META,
  JOB_WORKPLACE_TYPES,
  JOB_WORKPLACE_TYPE_META,
} from '@/lib/constants/listing'
import { groupCategoriesByParent } from '@/lib/categories/sort'
import type { CategoryOption } from '@/app/add-business/page'
import { Field, inputCls } from './Field'
import type { HiringBusiness, StepProps } from './types'

interface Props extends StepProps {
  businesses: HiringBusiness[]
  categories: CategoryOption[]
}

const selectCls = 'appearance-none cursor-pointer'

export function StepRole({ values, errors, set, businesses, categories }: Props) {
  if (businesses.length === 0) {
    return (
      <div className="rounded-lg border border-charcoal/20 bg-pale-lavender p-4">
        <p className="font-subhead text-sm font-semibold text-brand-black">
          You need a published business page first
        </p>
        <p className="font-subhead text-sm text-charcoal mt-1">
          A job is posted for a business. Add yours, and once it is live you can post here.
        </p>
        <Link
          href="/add-business"
          className="mt-3 inline-flex h-11 items-center rounded-full bg-amber-gold px-5 font-subhead text-sm font-bold text-brand-black"
        >
          Add your business
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <Field id="hiringListingId" label="Hiring business" required error={errors.hiringListingId}>
        {({ describedBy, invalid }) => (
          <select
            id="hiringListingId"
            value={values.hiringListingId}
            onChange={(e) => set('hiringListingId', e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className={`${inputCls(invalid)} ${selectCls}`}
          >
            <option value="" disabled>
              Choose a business
            </option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </Field>

      <Field id="name" label="Job title" required error={errors.name}>
        {({ describedBy, invalid }) => (
          <input
            id="name"
            type="text"
            maxLength={120}
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            autoComplete="off"
            placeholder="e.g. Line Cook"
            className={inputCls(invalid)}
          />
        )}
      </Field>

      <Field
        id="tagline"
        label="One-line summary"
        required
        hint="Shown under the title in search. 10 to 120 characters."
        error={errors.tagline}
      >
        {({ describedBy, invalid }) => (
          <input
            id="tagline"
            type="text"
            maxLength={120}
            value={values.tagline}
            onChange={(e) => set('tagline', e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            autoComplete="off"
            className={inputCls(invalid)}
          />
        )}
      </Field>

      <Field id="categoryId" label="Category" required error={errors.categoryId}>
        {({ describedBy, invalid }) => (
          <select
            id="categoryId"
            value={values.categoryId}
            onChange={(e) => set('categoryId', e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className={`${inputCls(invalid)} ${selectCls}`}
          >
            <option value="" disabled>
              Choose a category
            </option>
            {groupCategoriesByParent(categories).map(({ parent, children }) =>
              children.length === 0 ? (
                <option key={parent.id} value={parent.id}>
                  {parent.name}
                </option>
              ) : (
                <optgroup key={parent.id} label={parent.name}>
                  <option value={parent.id}>All {parent.name}</option>
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              )
            )}
          </select>
        )}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field id="employmentType" label="Kind of work" required error={errors.employmentType}>
          {({ describedBy, invalid }) => (
            <select
              id="employmentType"
              value={values.employmentType}
              onChange={(e) => set('employmentType', e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              className={`${inputCls(invalid)} ${selectCls}`}
            >
              <option value="" disabled>
                Choose one
              </option>
              {JOB_EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {JOB_EMPLOYMENT_TYPE_META[t].label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field id="workplaceType" label="Where it is done" required error={errors.workplaceType}>
          {({ describedBy, invalid }) => (
            <select
              id="workplaceType"
              value={values.workplaceType}
              onChange={(e) => set('workplaceType', e.target.value)}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              className={`${inputCls(invalid)} ${selectCls}`}
            >
              {JOB_WORKPLACE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {JOB_WORKPLACE_TYPE_META[t].label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
    </div>
  )
}
