import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import type { Missing, QuickStartAnswers } from '@/lib/listings/quickStart'

export interface StepProps {
  answers: QuickStartAnswers
  onChange: (patch: Partial<QuickStartAnswers>) => void
  /** This step's problem after "Next" or "Save my draft", else null. */
  problem: Missing | null
}

export const ERROR_ID = 'qs-error'

// 16px text so iOS does not zoom into the field.
export function inputClass(invalid: boolean): string {
  return cn(
    'h-12 w-full rounded-lg border bg-white px-3 font-subhead text-base text-brand-black',
    'placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black',
    invalid ? 'border-red-500' : 'border-charcoal/30'
  )
}

export function textareaClass(invalid: boolean): string {
  return cn(
    'w-full rounded-lg border bg-white px-3 py-2.5 font-subhead text-base leading-relaxed text-brand-black',
    'placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black',
    invalid ? 'border-red-500' : 'border-charcoal/30'
  )
}

export const LABEL_CLASS = 'block font-subhead text-sm font-semibold text-brand-black mb-1.5'
export const HINT_CLASS = 'font-subhead text-sm text-charcoal-soft'

/** The reason a step is not done yet, read out when it appears. */
export function StepError({ problem }: { problem: Missing | null }) {
  if (!problem) return null
  return (
    <p id={ERROR_ID} role="alert" className="font-subhead text-sm font-semibold text-red-700">
      {problem.reason}
    </p>
  )
}

/** aria-describedby / aria-invalid for the field a problem points at. */
export function fieldA11y(problem: Missing | null, fieldId: string, hintId?: string) {
  const invalid = problem?.fieldId === fieldId
  const ids = [hintId, invalid ? ERROR_ID : undefined].filter(Boolean).join(' ')
  return {
    'aria-invalid': invalid || undefined,
    'aria-describedby': ids || undefined,
  }
}

export function CharCount({ value, max }: { value: string; max: number }) {
  const n = value.trim().length
  return (
    <span
      className={cn(
        'font-subhead text-xs tabular-nums',
        n > max ? 'text-red-700 font-semibold' : 'text-charcoal-soft'
      )}
    >
      {n} / {max}
    </span>
  )
}

export function StepIntro({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2
        id="qs-step-title"
        tabIndex={-1}
        className="font-headline text-2xl leading-tight text-brand-black text-balance focus:outline-none md:text-[28px]"
      >
        {title}
      </h2>
      {children && (
        <div className="font-subhead text-base leading-relaxed text-charcoal">{children}</div>
      )}
    </div>
  )
}
