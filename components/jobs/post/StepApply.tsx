import { cn } from '@/lib/utils'
import { Field, inputCls } from './Field'
import type { StepProps } from './types'

export function StepApply({ values, errors, set }: StepProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* The `*` belongs on the legend, not on either input: one of the two is
          required, so marking a field required would block a posting that gave the
          other one. The group is what is required. */}
      <fieldset className="flex flex-col gap-3">
        <legend className="font-subhead text-sm font-semibold text-brand-black">
          How people apply <span className="text-red-700" aria-hidden="true">*</span>
        </legend>
        <p className="font-subhead text-xs text-charcoal-soft">
          Add at least one. It becomes the Apply button on your posting.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field id="applyUrl" label="Application link" error={errors.applyUrl}>
            {({ describedBy, invalid }) => (
              <input
                id="applyUrl"
                name="apply_url"
                type="url"
                inputMode="url"
                value={values.applyUrl}
                onChange={(e) => set('applyUrl', e.target.value)}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder="https://"
                className={inputCls(invalid)}
              />
            )}
          </Field>
          <Field id="applyEmail" label="Or an email to apply to" error={errors.applyEmail}>
            {({ describedBy, invalid }) => (
              <input
                id="applyEmail"
                name="apply_email"
                type="email"
                autoComplete="email"
                value={values.applyEmail}
                onChange={(e) => set('applyEmail', e.target.value)}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder="hiring@example.com"
                className={inputCls(invalid)}
              />
            )}
          </Field>
        </div>
      </fieldset>

      <Field
        id="description"
        label="About this role"
        required
        hint="What the role involves, who you are looking for, and what you offer. 20 to 2000 characters."
        error={errors.description}
      >
        {({ describedBy, invalid }) => (
          <textarea
            id="description"
            rows={7}
            maxLength={2000}
            value={values.description}
            onChange={(e) => set('description', e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            className={cn(
              inputCls(invalid),
              'h-auto py-2.5 resize-y min-h-[11rem]'
            )}
          />
        )}
      </Field>
    </div>
  )
}
