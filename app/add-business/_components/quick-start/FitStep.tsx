'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils'
import { suggestCategories, type GuideAnswer, type GuideCategory } from '@/lib/categories/sorting-guide'
import {
  FIELD_IDS,
  REQUEST_NAME_MAX,
  REQUEST_WORDS_MAX,
  defaultRequestParent,
  firstFitLayer,
  fitOptions,
  fitQuery,
  nextFitLayer,
  type FitLayer,
} from '@/lib/listings/quickStart'
import { FitSuggest } from './FitSuggest'
import { HINT_CLASS, StepError, StepIntro, type StepProps } from './shared'

interface Props extends StepProps {
  categories: readonly GuideCategory[]
  /** Called after a tap that settles the category, to move to the next step. */
  onPicked: () => void
}

const OPTION_CLASS =
  'flex min-h-[56px] w-full flex-col items-start justify-center rounded-xl border border-charcoal/20 bg-white px-4 py-3 text-left transition-colors hover:border-brand-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2'
const PRIMARY_CLASS =
  'inline-flex min-h-[48px] items-center justify-center rounded-full bg-brand-black px-6 font-subhead text-base font-bold text-white hover:bg-charcoal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2'
const QUIET_CLASS =
  'inline-flex min-h-[48px] items-center justify-center rounded-full border border-charcoal/30 bg-white px-6 font-subhead text-base font-semibold text-brand-black hover:border-brand-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-black focus-visible:ring-offset-2'

export function FitStep({ answers, onChange, problem, categories, onPicked }: Props) {
  const options = useMemo(() => fitOptions(fitQuery(answers), categories), [answers, categories])
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const [layer, setLayer] = useState<FitLayer | 'chosen'>(() => {
    const fit = answers.fit
    if (fit?.kind === 'request') return 'suggest'
    if (fit && byId.has(fit.categoryId)) return 'chosen'
    return firstFitLayer(options)
  })
  const [group, setGroup] = useState<GuideAnswer | null>(null)
  const firstRender = useRef(true)

  // Move focus to the step heading on each new layer so keyboard and screen
  // reader users land on the new question, not on a button that just went away.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    document.getElementById('qs-step-title')?.focus()
  }, [layer, group])

  function label(cat: GuideCategory): { name: string; parent: string | null } {
    const parent = cat.parent_id ? byId.get(cat.parent_id) : undefined
    return { name: cat.name, parent: parent?.name ?? null }
  }

  function choose(cat: GuideCategory, answerId?: string) {
    onChange({ fit: { kind: 'category', categoryId: cat.id, answerId } })
    onPicked()
  }

  function notQuite() {
    if (layer === 'chosen') return
    const next = nextFitLayer(layer, options)
    if (next === 'suggest') startSuggest(group?.id)
    else setLayer(next)
  }

  function startSuggest(answerId?: string) {
    onChange({
      fit: {
        kind: 'request',
        parentId: defaultRequestParent(options, categories, answerId),
        proposedName: '',
        words: answers.about.trim().slice(0, REQUEST_WORDS_MAX),
      },
    })
    setGroup(null)
    setLayer('suggest')
  }

  function restart() {
    onChange({ fit: null })
    setGroup(null)
    setLayer(firstFitLayer(options))
  }

  const chosen = answers.fit?.kind === 'category' ? byId.get(answers.fit.categoryId) : undefined
  const heading =
    layer === 'chosen' || layer === 'best'
      ? "Here's how we'd list you"
      : layer === 'more'
          ? 'Maybe one of these?'
          : layer === 'groups'
            ? group
              ? group.label
              : 'Which of these is closest?'
            : 'Suggest a new category'

  const subGroup = group ? suggestCategories(group, answers.where || null, categories) : null

  return (
    <>
      <StepIntro title={heading}>
        {layer === 'groups' && !group && options.best === null && (
          <>We couldn&apos;t match your words to a category yet. Pick the closest area.</>
        )}
        {layer === 'suggest' && (
          <>
            Your page sits under the closest group until our team adds the new category. We&apos;ll
            email you either way.
          </>
        )}
      </StepIntro>

      <div id={FIELD_IDS.fit} tabIndex={-1} className="flex shrink-0 flex-col gap-3 focus:outline-none">
        {layer === 'chosen' && chosen && (
          <div className="flex flex-col gap-3 rounded-xl border border-brand-black bg-white p-4">
            <CategoryName {...label(chosen)} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={QUIET_CLASS} onClick={restart}>
                Change
              </button>
            </div>
          </div>
        )}

        {layer === 'best' && options.best && (
          <div className="flex flex-col gap-4 rounded-xl border border-charcoal/20 bg-white p-4">
            <CategoryName {...label(options.best)} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={PRIMARY_CLASS} onClick={() => choose(options.best as GuideCategory)}>
                Yes, list me here
              </button>
              <button type="button" className={QUIET_CLASS} onClick={notQuite}>
                Not quite
              </button>
            </div>
          </div>
        )}

        {layer === 'more' && (
          <>
            <ul className="flex flex-col gap-2">
              {options.more.map((cat) => (
                <li key={cat.id}>
                  <button type="button" className={OPTION_CLASS} onClick={() => choose(cat)}>
                    <CategoryName {...label(cat)} />
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className={cn(QUIET_CLASS, 'self-start')} onClick={notQuite}>
              Not quite
            </button>
          </>
        )}

        {layer === 'groups' && !group && (
          <>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {options.groups.map((g) => (
                <li key={g.id} className="flex">
                  <button type="button" className={OPTION_CLASS} onClick={() => setGroup(g)}>
                    <span className="font-subhead text-base font-bold text-brand-black">{g.label}</span>
                    <span className="font-subhead text-sm text-charcoal-soft">{g.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className={cn(QUIET_CLASS, 'self-start')} onClick={notQuite}>
              None of these fit
            </button>
          </>
        )}

        {layer === 'groups' && group && subGroup && (
          <>
            <ul className="flex flex-col gap-2">
              {[...subGroup.best, ...subGroup.more].map((cat) => (
                <li key={cat.id}>
                  <button type="button" className={OPTION_CLASS} onClick={() => choose(cat, group.id)}>
                    <CategoryName {...label(cat)} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={QUIET_CLASS} onClick={() => setGroup(null)}>
                Back to all groups
              </button>
              <button type="button" className={QUIET_CLASS} onClick={() => startSuggest(group.id)}>
                Suggest a new category
              </button>
            </div>
          </>
        )}

        {layer === 'suggest' && answers.fit?.kind === 'request' && (
          <FitSuggest
            fit={answers.fit}
            parents={options.parents}
            problem={problem}
            onChange={(fit) => onChange({ fit })}
            onBack={restart}
            maxName={REQUEST_NAME_MAX}
          />
        )}
      </div>
      {layer !== 'suggest' && problem?.fieldId === FIELD_IDS.fit && <StepError problem={problem} />}
      {layer === 'best' && <p className={HINT_CLASS}>You can change this later.</p>}
    </>
  )
}

function CategoryName({ name, parent }: { name: string; parent: string | null }) {
  return (
    <span className="flex flex-col">
      <span className="font-subhead text-base font-bold text-brand-black">{name}</span>
      {parent && <span className="font-subhead text-sm text-charcoal-soft">in {parent}</span>}
    </span>
  )
}
