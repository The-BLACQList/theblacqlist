'use client'

import { useMemo } from 'react'

import { LEVEL_META } from '@/lib/listings/levels'
import {
  FIELD_IDS,
  chosenLevel,
  roleOptions,
  type QuickCategory,
} from '@/lib/listings/quickStart'
import { ChoiceCards } from './ChoiceCards'
import { HINT_CLASS, StepError, StepIntro, type StepProps } from './shared'

// "What's your main role?" Only shown when the picked category allows more
// than one level (docs/blacqlist/product/business-levels-2026-10.md). The
// category's default is already picked, so Next always works.

interface Props extends StepProps {
  categories: readonly QuickCategory[]
}

export function RoleStep({ answers, onChange, problem, categories }: Props) {
  const options = useMemo(() => roleOptions(answers, categories), [answers, categories])
  const value = chosenLevel(answers, categories) ?? ''
  const choices = (options?.allowed_levels ?? []).map((level) => ({
    value: level,
    title: LEVEL_META[level].label,
    hint: LEVEL_META[level].description,
  }))

  return (
    <>
      <StepIntro title="What's your main role?">
        Pick the one that fits best. Shoppers can filter by it.
      </StepIntro>
      <div id={FIELD_IDS.role} tabIndex={-1} className="focus:outline-none">
        <ChoiceCards
          name="qs-role"
          legend="Your main role"
          idPrefix="qs-role"
          choices={choices}
          value={value}
          onChange={(level) => onChange({ level: level as typeof answers.level })}
          describedBy="qs-role-hint"
          columns={1}
        />
      </div>
      <p id="qs-role-hint" className={HINT_CLASS}>
        Do more than one? Add the others on the next page.
      </p>
      <StepError problem={problem} />
    </>
  )
}
