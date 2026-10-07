'use client'

import type { GuideCategory } from '@/lib/categories/sorting-guide'
import { FIELD_IDS, REQUEST_WORDS_MAX, type FitChoice, type Missing } from '@/lib/listings/quickStart'
import {
  CharCount,
  HINT_CLASS,
  LABEL_CLASS,
  StepError,
  fieldA11y,
  inputClass,
  textareaClass,
} from './shared'

type RequestFit = Extract<FitChoice, { kind: 'request' }>

interface Props {
  fit: RequestFit
  parents: readonly GuideCategory[]
  problem: Missing | null
  onChange: (fit: RequestFit) => void
  onBack: () => void
  maxName: number
}

// "Suggest a new category": the page lists under the closest group right away,
// and the team reviews the new name in /admin/category-requests.
export function FitSuggest({ fit, parents, problem, onChange, onBack, maxName }: Props) {
  const parentInvalid = problem?.fieldId === FIELD_IDS.fit
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="qs-request-parent" className={LABEL_CLASS}>
          Closest group
        </label>
        <select
          id="qs-request-parent"
          value={fit.parentId}
          onChange={(e) => onChange({ ...fit, parentId: e.target.value })}
          className={inputClass(parentInvalid)}
          {...fieldA11y(problem, FIELD_IDS.fit, 'qs-request-parent-hint')}
        >
          <option value="">Pick a group</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <p id="qs-request-parent-hint" className={HINT_CLASS}>
          Your page lists here until the new category is added.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={FIELD_IDS.requestName} className={LABEL_CLASS}>
          New category name
        </label>
        <input
          id={FIELD_IDS.requestName}
          type="text"
          value={fit.proposedName}
          onChange={(e) => onChange({ ...fit, proposedName: e.target.value })}
          maxLength={maxName}
          placeholder="Loc stylist"
          className={inputClass(problem?.fieldId === FIELD_IDS.requestName)}
          {...fieldA11y(problem, FIELD_IDS.requestName)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="qs-request-words" className={LABEL_CLASS}>
          Anything we should know? <span className="font-normal text-charcoal-soft">(optional)</span>
        </label>
        <textarea
          id="qs-request-words"
          rows={3}
          value={fit.words}
          onChange={(e) => onChange({ ...fit, words: e.target.value })}
          className={textareaClass(false)}
          aria-describedby="qs-request-words-hint"
        />
        <div className="flex items-start justify-between gap-3">
          <p id="qs-request-words-hint" className={HINT_CLASS}>
            We started this from what you wrote about your business.
          </p>
          <CharCount value={fit.words} max={REQUEST_WORDS_MAX} />
        </div>
      </div>

      <StepError problem={problem} />

      <button
        type="button"
        onClick={onBack}
        className="self-start font-subhead text-sm font-semibold text-brand-black underline underline-offset-2 min-h-[44px]"
      >
        Back to the suggestions
      </button>
    </div>
  )
}
