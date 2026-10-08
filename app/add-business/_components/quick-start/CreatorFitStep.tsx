'use client'

import type { GuideCategory } from '@/lib/categories/sorting-guide'
import { FIELD_IDS } from '@/lib/listings/quickStart'
import { ChoiceCards } from './ChoiceCards'
import { ERROR_ID, HINT_CLASS, StepError, StepIntro, type StepProps } from './shared'

// The creator path's category step (ticket 132). Creators pick one of the
// Creators subcategories; niche, platforms and audience come later in the
// finish view, so there is no guide or "suggest a category" layer here.

interface Props extends StepProps {
  /** The Creators subcategories only. */
  categories: readonly GuideCategory[]
  /** Called after a pick, to move to the next step. */
  onPicked: () => void
}

export function CreatorFitStep({ answers, onChange, problem, categories, onPicked }: Props) {
  const chosen = answers.fit?.kind === 'category' ? answers.fit.categoryId : ''
  const choices = categories.map((c) => ({ value: c.id, title: c.name }))

  return (
    <>
      <StepIntro title="What do you make most?">
        Pick the closest one. You can add your niche and platforms next.
      </StepIntro>
      <div id={FIELD_IDS.fit} tabIndex={-1} className="focus:outline-none">
        <ChoiceCards
          name="creator-fit"
          legend="What you make most"
          idPrefix="qs-creator-fit"
          choices={choices}
          value={chosen}
          onChange={(categoryId) => {
            onChange({ fit: { kind: 'category', categoryId } })
            onPicked()
          }}
          describedBy={problem?.fieldId === FIELD_IDS.fit ? ERROR_ID : undefined}
        />
      </div>
      <p className={HINT_CLASS}>You can change this later.</p>
      <StepError problem={problem} />
    </>
  )
}
