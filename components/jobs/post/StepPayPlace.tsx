import { JOB_SALARY_PERIODS, JOB_SALARY_PERIOD_META } from '@/lib/constants/listing'
import { isVolunteer } from '@/lib/validations/postJob'
import { Field, inputCls } from './Field'
import type { HiringBusiness, StepProps } from './types'

interface Props extends StepProps {
  business: HiringBusiness | null
}

export function StepPayPlace({ values, errors, set, business }: Props) {
  const volunteer = isVolunteer(values.employmentType)
  const remote = values.workplaceType === 'remote'
  const place = business?.cityName
    ? `${business.cityName}${business.stateAbbr ? `, ${business.stateAbbr}` : ''}`
    : null

  return (
    <div className="flex flex-col gap-6">
      {volunteer ? (
        <p className="rounded-lg border border-charcoal/20 bg-pale-lavender p-3 font-subhead text-sm text-charcoal">
          Volunteer roles have no pay to enter. Shown as Unpaid.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="font-subhead text-xs text-charcoal-soft">
            Roles with a pay range get more applicants.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field id="salaryMin" label="Lowest pay" required error={errors.salaryMin}>
              {({ describedBy, invalid }) => (
                <input
                  id="salaryMin"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={values.salaryMin}
                  onChange={(e) => set('salaryMin', e.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  placeholder="18"
                  className={inputCls(invalid)}
                />
              )}
            </Field>
            <Field id="salaryMax" label="Highest pay" required error={errors.salaryMax}>
              {({ describedBy, invalid }) => (
                <input
                  id="salaryMax"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={values.salaryMax}
                  onChange={(e) => set('salaryMax', e.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  placeholder="22"
                  className={inputCls(invalid)}
                />
              )}
            </Field>
            <Field id="salaryPeriod" label="Paid" required error={errors.salaryPeriod}>
              {({ describedBy, invalid }) => (
                <select
                  id="salaryPeriod"
                  value={values.salaryPeriod}
                  onChange={(e) => set('salaryPeriod', e.target.value)}
                  aria-describedby={describedBy}
                  aria-invalid={invalid}
                  className={`${inputCls(invalid)} appearance-none cursor-pointer`}
                >
                  <option value="" disabled>
                    Choose one
                  </option>
                  {JOB_SALARY_PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {JOB_SALARY_PERIOD_META[p].label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        </div>
      )}

      {!remote && (
        <div className="flex flex-col gap-1">
          <p className="font-subhead text-sm font-semibold text-brand-black">Place</p>
          <p className="font-subhead text-sm text-charcoal">
            {place ?? 'No city on your business page yet'}
          </p>
          <p className="font-subhead text-xs text-charcoal-soft">
            We use the city from your business page{business ? `, ${business.name}` : ''}.
          </p>
        </div>
      )}

      <Field
        id="closesAt"
        label="Applications close"
        optionalNote="(optional)"
        hint="If you leave this blank we close it 30 days after it goes live."
        error={errors.closesAt}
      >
        {({ describedBy, invalid }) => (
          <input
            id="closesAt"
            type="date"
            value={values.closesAt}
            onChange={(e) => set('closesAt', e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className={inputCls(invalid)}
          />
        )}
      </Field>
    </div>
  )
}
