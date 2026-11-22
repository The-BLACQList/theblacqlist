'use client'

import { useActionState, useRef, useState } from 'react'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { updateJobDetailsAction } from '@/lib/actions/dashboard/updateJobDetails'
import { ItemWriteHelp } from '@/components/ai/ItemWriteHelp'
import type { ItemHelp } from '@/lib/ai/itemHelp'
import type { ItemInput } from '@/lib/ai/itemFacts'
import { easternToday } from '@/lib/validations/postJob'
import {
  JOB_EMPLOYMENT_TYPES,
  JOB_EMPLOYMENT_TYPE_META,
  JOB_WORKPLACE_TYPES,
  JOB_WORKPLACE_TYPE_META,
  JOB_SALARY_PERIODS,
  JOB_SALARY_PERIOD_META,
} from '@/lib/constants/listing'

interface JobValues {
  description: string | null
  employment_type: string
  workplace_type: string
  salary_min: number | null
  salary_max: number | null
  salary_period: string | null
  salary_currency: string
  apply_url: string | null
  apply_email: string | null
  closes_at: string | null
  hiring_listing_id: string | null
}

interface Props {
  listingId: string
  /** The job title (the listing's name), which AI help writes about. */
  title?: string
  job: JobValues | null
  businesses: { id: string; name: string }[]
  /** Ticket 242: AI help under About This Role. Null hides it. */
  aiHelp?: ItemHelp
}

/**
 * `closes_at` is a timestamptz stored as the end of the chosen day in Eastern
 * time (ticket 152), so the date input shows that Eastern day, the same day the
 * public page prints.
 */
function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return easternToday(d)
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40'
const labelCls = 'block font-subhead text-xs font-semibold text-charcoal-soft mb-1'

export function JobDetailsSection({
  listingId,
  title = '',
  job,
  businesses,
  aiHelp = null,
}: Props) {
  const [state, formAction, isPending] = useActionState(updateJobDetailsAction, null)
  const [workplaceType, setWorkplaceType] = useState(job?.workplace_type ?? 'on-site')
  const formRef = useRef<HTMLFormElement>(null)
  const descRef = useRef<HTMLTextAreaElement>(null)

  // What the form says so far, saved or not. Pay goes in only as the owner
  // typed it, so the write-up never names a figure they didn't.
  function jobItem(): ItemInput | null {
    if (!title.trim() || !formRef.current) return null
    const data = new FormData(formRef.current)
    const read = (key: string) => data.get(key)?.toString().trim() ?? ''
    const label = (meta: Record<string, { label: string }>, key: string) => meta[key]?.label ?? null
    const amounts = [read('salary_min'), read('salary_max')].filter(Boolean).map((n) => '$' + n)
    const period = label(JOB_SALARY_PERIOD_META, read('salary_period'))
    const pay = amounts.length
      ? [amounts.join(' to '), period ? period.toLowerCase() : ''].filter(Boolean).join(' ')
      : null
    return {
      kind: 'job',
      title,
      employmentType: label(JOB_EMPLOYMENT_TYPE_META, read('employment_type')),
      workplaceType: label(JOB_WORKPLACE_TYPE_META, read('workplace_type')),
      pay,
      notes: read('description') || null,
    }
  }

  const fieldErr = (f: string) => (state && 'field' in state && state.field === f ? state.error : null)

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Job Details</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          The role, where it happens, what it pays, and how to apply.
        </p>
      </div>

      <form ref={formRef} action={formAction} className="px-5 py-4 space-y-4">
        <input type="hidden" name="listing_id" value={listingId} />
        <input type="hidden" name="salary_currency" value={job?.salary_currency ?? 'USD'} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="jb-employment" className={labelCls}>
              Employment Type
            </label>
            <select
              id="jb-employment"
              name="employment_type"
              required
              defaultValue={job?.employment_type ?? 'full-time'}
              className={`${inputCls} appearance-none cursor-pointer`}
            >
              {JOB_EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {JOB_EMPLOYMENT_TYPE_META[t].label}
                </option>
              ))}
            </select>
            {fieldErr('employment_type') && (
              <p role="alert" className="font-body text-xs text-red-600 mt-0.5">
                {fieldErr('employment_type')}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="jb-workplace" className={labelCls}>
              Where the Work Happens
            </label>
            <select
              id="jb-workplace"
              name="workplace_type"
              required
              value={workplaceType}
              onChange={(e) => setWorkplaceType(e.target.value)}
              className={`${inputCls} appearance-none cursor-pointer`}
            >
              {JOB_WORKPLACE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {JOB_WORKPLACE_TYPE_META[t].label}
                </option>
              ))}
            </select>
            {fieldErr('workplace_type') && (
              <p role="alert" className="font-body text-xs text-red-600 mt-0.5">
                {fieldErr('workplace_type')}
              </p>
            )}
          </div>
        </div>

        {workplaceType === 'remote' && (
          <p className="font-body text-xs text-charcoal-soft">
            Remote roles publish without a work location. The listing&apos;s city still controls where
            it appears in discovery.
          </p>
        )}

        <fieldset className="border border-charcoal/15 rounded-lg px-3 pt-2 pb-3">
          <legend className="font-subhead text-xs font-semibold text-charcoal-soft px-1">
            Pay <span className="font-normal text-charcoal-faint">(optional)</span>
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="jb-salary-min" className={labelCls}>
                Minimum
              </label>
              <input
                id="jb-salary-min"
                name="salary_min"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                defaultValue={job?.salary_min ?? ''}
                className={inputCls}
                placeholder="20"
              />
              {fieldErr('salary_min') && (
                <p role="alert" className="font-body text-xs text-red-600 mt-0.5">
                  {fieldErr('salary_min')}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="jb-salary-max" className={labelCls}>
                Maximum
              </label>
              <input
                id="jb-salary-max"
                name="salary_max"
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                defaultValue={job?.salary_max ?? ''}
                className={inputCls}
                placeholder="28"
              />
              {fieldErr('salary_max') && (
                <p role="alert" className="font-body text-xs text-red-600 mt-0.5">
                  {fieldErr('salary_max')}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="jb-salary-period" className={labelCls}>
                Per
              </label>
              <select
                id="jb-salary-period"
                name="salary_period"
                defaultValue={job?.salary_period ?? ''}
                className={`${inputCls} appearance-none cursor-pointer`}
              >
                <option value="">—</option>
                {JOB_SALARY_PERIODS.map((p) => (
                  <option key={p} value={p}>
                    {JOB_SALARY_PERIOD_META[p].label}
                  </option>
                ))}
              </select>
              {fieldErr('salary_period') && (
                <p role="alert" className="font-body text-xs text-red-600 mt-0.5">
                  {fieldErr('salary_period')}
                </p>
              )}
            </div>
          </div>
          <p className="font-body text-xs text-charcoal-soft mt-2">
            Leave blank to hide pay. If you enter an amount, choose a period.
          </p>
        </fieldset>

        {/* The `*` belongs on the legend, not on either input — updateJobDetails
            requires ONE of the two, so marking a field required would block a
            posting that supplied the other. The group is what is required. */}
        <fieldset className="border border-charcoal/15 rounded-lg px-3 pt-2 pb-3">
          <legend className="font-subhead text-xs font-semibold text-charcoal-soft px-1">
            How People Apply <span className="text-red-500" aria-hidden="true">*</span>
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="jb-apply-url" className={labelCls}>
                Application Link
              </label>
              <input
                id="jb-apply-url"
                name="apply_url"
                type="url"
                defaultValue={job?.apply_url ?? ''}
                className={inputCls}
                placeholder="https://…"
              />
              {fieldErr('apply_url') && (
                <p role="alert" className="font-body text-xs text-red-600 mt-0.5">
                  {fieldErr('apply_url')}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="jb-apply-email" className={labelCls}>
                Apply by Email
              </label>
              <input
                id="jb-apply-email"
                name="apply_email"
                type="email"
                defaultValue={job?.apply_email ?? ''}
                className={inputCls}
                placeholder="hiring@example.com"
              />
              {fieldErr('apply_email') && (
                <p role="alert" className="font-body text-xs text-red-600 mt-0.5">
                  {fieldErr('apply_email')}
                </p>
              )}
            </div>
          </div>
          <p className="font-body text-xs text-charcoal-soft mt-2">
            Add at least one. It becomes the Apply button on your posting.
          </p>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="jb-closes" className={labelCls}>
              Closes <span className="font-normal text-charcoal-faint">(optional)</span>
            </label>
            <input
              id="jb-closes"
              name="closes_at"
              type="date"
              defaultValue={toDateInput(job?.closes_at ?? null)}
              className={inputCls}
            />
            {fieldErr('closes_at') && (
              <p role="alert" className="font-body text-xs text-red-600 mt-0.5">
                {fieldErr('closes_at')}
              </p>
            )}
          </div>
          {businesses.length > 0 && (
            <div>
              <label htmlFor="jb-hiring" className={labelCls}>
                Hiring Business <span className="font-normal text-charcoal-faint">(optional)</span>
              </label>
              <select
                id="jb-hiring"
                name="hiring_listing_id"
                defaultValue={job?.hiring_listing_id ?? ''}
                className={`${inputCls} appearance-none cursor-pointer`}
              >
                <option value="">No linked business</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div>
          <label htmlFor="jb-desc" className={labelCls}>
            About This Role
          </label>
          <textarea
            ref={descRef}
            id="jb-desc"
            name="description"
            rows={5}
            maxLength={2000}
            defaultValue={job?.description ?? ''}
            className={`${inputCls} resize-y`}
            placeholder="What the work is, who it's for, what you're looking for."
          />
          <div className="mt-2">
            <ItemWriteHelp
              listingId={listingId}
              agentType="job_description"
              help={aiHelp}
              getItem={jobItem}
              missing="Give the job a title first, then ask."
              getValue={() => descRef.current?.value ?? ''}
              setValue={(text) => {
                if (descRef.current) descRef.current.value = text.slice(0, 2000)
              }}
            />
          </div>
        </div>

        {state && 'error' in state && !('field' in state && state.field) && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2"
          >
            <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-red-700">{state.error}</p>
          </div>
        )}
        {state && 'success' in state && (
          <div className="flex items-center gap-2 text-success">
            <CheckCircle className="size-4 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm">Saved.</p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isPending ? 'Saving…' : 'Save Job Details'}
          </button>
        </div>
      </form>
    </div>
  )
}
