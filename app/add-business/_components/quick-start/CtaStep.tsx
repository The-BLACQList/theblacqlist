'use client'

import { FIELD_IDS, QUICK_CTAS, findCta } from '@/lib/listings/quickStart'
import { ChoiceCards } from './ChoiceCards'
import {
  ERROR_ID,
  LABEL_CLASS,
  StepError,
  StepIntro,
  fieldA11y,
  inputClass,
  type StepProps,
} from './shared'

const CTA_CHOICES = QUICK_CTAS.map((c) => ({ value: c.value, title: c.label }))

const INPUT_TYPE = { url: 'url', tel: 'tel', email: 'email' } as const
const AUTOCOMPLETE = { url: 'url', tel: 'tel', email: 'email' } as const

interface Props extends StepProps {
  /** The owner's sign-in email, the starting value for "Send a message". */
  email: string
}

export function CtaStep({ answers, onChange, problem, email }: Props) {
  const cta = findCta(answers.ctaType)
  const typeProblem = problem?.fieldId === FIELD_IDS.ctaType ? problem : null

  return (
    <>
      <StepIntro title="What should your main button do?">
        The big button on your page. Pick the one thing you most want people to do.
      </StepIntro>
      <ChoiceCards
        name="cta"
        legend="Main button"
        idPrefix="qs-cta"
        choices={CTA_CHOICES}
        value={answers.ctaType}
        onChange={(v) => {
          if (v === answers.ctaType) return
          // A booking link is not a phone number, so a new type starts fresh.
          onChange({ ctaType: v, ctaUrl: v === 'message' ? email : '' })
        }}
        describedBy={typeProblem ? ERROR_ID : undefined}
      />

      {cta && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={FIELD_IDS.ctaUrl} className={LABEL_CLASS}>
            {cta.inputLabel}
          </label>
          <input
            id={FIELD_IDS.ctaUrl}
            type={INPUT_TYPE[cta.input]}
            inputMode={cta.input === 'tel' ? 'tel' : cta.input === 'email' ? 'email' : 'url'}
            autoComplete={AUTOCOMPLETE[cta.input]}
            value={answers.ctaUrl}
            onChange={(e) => onChange({ ctaUrl: e.target.value })}
            placeholder={cta.placeholder}
            className={inputClass(problem?.fieldId === FIELD_IDS.ctaUrl)}
            {...fieldA11y(problem, FIELD_IDS.ctaUrl)}
          />
        </div>
      )}

      <StepError problem={problem} />
    </>
  )
}
