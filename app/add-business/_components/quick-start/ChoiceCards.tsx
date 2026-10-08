'use client'

import { cn } from '@/lib/utils'

// Native radios styled as cards, so arrow keys, Tab and screen readers work
// without extra code. Each radio's id is `${idPrefix}-${value}`, which is what
// FIELD_IDS in lib/listings/quickStart.ts points the focus at.

export interface Choice {
  value: string
  title: string
  hint?: string
}

interface Props {
  name: string
  legend: string
  idPrefix: string
  choices: readonly Choice[]
  value: string
  onChange: (value: string) => void
  describedBy?: string
  columns?: 1 | 2
}

export function ChoiceCards({
  name,
  legend,
  idPrefix,
  choices,
  value,
  onChange,
  describedBy,
  columns = 2,
}: Props) {
  return (
    <fieldset aria-describedby={describedBy} className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className={cn('grid grid-cols-1 gap-3', columns === 2 && 'sm:grid-cols-2')}>
        {choices.map((choice) => {
          const id = `${idPrefix}-${choice.value}`
          const checked = value === choice.value
          return (
            <label
              key={choice.value}
              htmlFor={id}
              className={cn(
                'relative flex min-h-[56px] cursor-pointer flex-col justify-center rounded-xl border px-4 py-3 transition-colors',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-black has-[:focus-visible]:ring-offset-2',
                checked
                  ? 'border-brand-black bg-brand-black text-white'
                  : 'border-charcoal/20 bg-white text-charcoal hover:border-charcoal/50 hover:text-brand-black'
              )}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={choice.value}
                checked={checked}
                onChange={() => onChange(choice.value)}
                className="sr-only"
              />
              <span className="font-subhead text-base font-bold">{choice.title}</span>
              {choice.hint && (
                <span
                  className={cn(
                    'mt-0.5 font-subhead text-sm',
                    checked ? 'text-white/80' : 'text-charcoal-soft'
                  )}
                >
                  {choice.hint}
                </span>
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
