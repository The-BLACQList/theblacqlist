'use client'

import { useState } from 'react'

import { GUIDE_WHERE, type GuideWhereId } from '@/lib/categories/sorting-guide'
import { FIELD_IDS } from '@/lib/listings/quickStart'
import { ChoiceCards } from './ChoiceCards'
import {
  ERROR_ID,
  HINT_CLASS,
  LABEL_CLASS,
  StepError,
  StepIntro,
  fieldA11y,
  inputClass,
  type StepProps,
} from './shared'

export interface CityOption {
  id: string
  name: string
  stateCode: string | null
}

const OTHER = '__other'

const WHERE_CHOICES = GUIDE_WHERE.map((w) => ({ value: w.id, title: w.label, hint: w.hint }))

interface Props extends StepProps {
  cities: readonly CityOption[]
}

export function WhereStep({ answers, onChange, problem, cities }: Props) {
  const [showOther, setShowOther] = useState(
    () => !answers.cityId && (answers.cityText !== '' || answers.stateText !== '')
  )
  const whereProblem = problem?.fieldId === FIELD_IDS.where ? problem : null

  return (
    <>
      <StepIntro title="Where do customers get what you do?" />
      <ChoiceCards
        name="where"
        legend="Where customers get what you do"
        idPrefix="qs-where"
        choices={WHERE_CHOICES}
        value={answers.where}
        onChange={(v) => onChange({ where: v as GuideWhereId })}
        describedBy={whereProblem ? ERROR_ID : undefined}
      />

      {answers.where && answers.where !== 'online' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={FIELD_IDS.city} className={LABEL_CLASS}>
              {answers.where === 'visit' ? 'City' : 'Main city you serve'}
            </label>
            <select
              id={FIELD_IDS.city}
              value={showOther ? OTHER : answers.cityId}
              onChange={(e) => {
                if (e.target.value === OTHER) {
                  setShowOther(true)
                  onChange({ cityId: '' })
                } else {
                  setShowOther(false)
                  onChange({ cityId: e.target.value, cityText: '', stateText: '' })
                }
              }}
              className={inputClass(problem?.fieldId === FIELD_IDS.city)}
              {...fieldA11y(problem, FIELD_IDS.city)}
            >
              <option value="">Pick your city</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.stateCode ? `${c.name}, ${c.stateCode}` : c.name}
                </option>
              ))}
              <option value={OTHER}>My city isn&apos;t listed</option>
            </select>
          </div>

          {showOther && (
            <div className="grid grid-cols-[1fr_6rem] gap-3">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor={FIELD_IDS.cityText} className={LABEL_CLASS}>
                  City
                </label>
                <input
                  id={FIELD_IDS.cityText}
                  type="text"
                  autoComplete="address-level2"
                  value={answers.cityText}
                  onChange={(e) => onChange({ cityText: e.target.value })}
                  className={inputClass(problem?.fieldId === FIELD_IDS.cityText)}
                  {...fieldA11y(problem, FIELD_IDS.cityText)}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="qs-state-text" className={LABEL_CLASS}>
                  State
                </label>
                <input
                  id="qs-state-text"
                  type="text"
                  autoComplete="address-level1"
                  maxLength={2}
                  value={answers.stateText}
                  onChange={(e) => onChange({ stateText: e.target.value.toUpperCase() })}
                  placeholder="GA"
                  className={inputClass(false)}
                />
              </div>
              <p className={`${HINT_CLASS} col-span-2`}>
                We&apos;ll add your city when we review your page.
              </p>
            </div>
          )}
        </div>
      )}

      <StepError problem={problem} />
    </>
  )
}
