'use client'

import { useId, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  GUIDE_ANSWERS,
  GUIDE_TYPE_LABELS,
  GUIDE_WHERE,
  buildGuidePick,
  findAnswer,
  findWhere,
  searchGuide,
  suggestCategories,
  type GuideCategory,
  type GuidePick,
  type GuideWhereId,
} from '@/lib/categories/sorting-guide'

/**
 * "Help me choose" on step 1 of /add-business (ticket 125). Two plain
 * questions, or a search box, suggest a category and a listing type. Picking
 * one fills the fields below it; every field stays editable. All the rules live
 * in lib/categories/sorting-guide.ts.
 */

interface Props {
  categories: GuideCategory[]
  /** Open on arrival when the owner hasn't picked a category yet. */
  defaultOpen: boolean
  onPick: (pick: GuidePick) => void
}

const chip =
  'rounded-lg border px-3 py-2 text-left font-subhead text-sm transition-colors min-h-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber'
const chipOn = 'border-brand-black bg-brand-black text-white'
const chipOff =
  'border-hairline bg-white text-charcoal hover:border-charcoal/50 hover:text-brand-black'

export function CategoryGuide({ categories, defaultOpen, onPick }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [query, setQuery] = useState('')
  const [answerId, setAnswerId] = useState<string | null>(null)
  const [whereId, setWhereId] = useState<GuideWhereId | null>(null)
  const [showMore, setShowMore] = useState(false)
  const [picked, setPicked] = useState<GuidePick | null>(null)
  const ids = useId()

  const answer = findAnswer(answerId)
  const results = searchGuide(query, categories)
  const suggestions = answer ? suggestCategories(answer, whereId, categories) : null
  const parentName = (cat: GuideCategory) =>
    cat.parent_id ? categories.find((c) => c.id === cat.parent_id)?.name : undefined

  function choose(cat: GuideCategory, from: 'search' | 'questions') {
    const pick = buildGuidePick(
      cat,
      categories,
      from === 'search' ? { query } : { answer, where: whereId }
    )
    setPicked(pick)
    setOpen(false)
    onPick(pick)
  }

  function renderCategory(cat: GuideCategory, from: 'search' | 'questions') {
    const parent = parentName(cat)
    return (
      <button
        key={cat.id}
        type="button"
        onClick={() => choose(cat, from)}
        className={cn(chip, chipOff)}
      >
        <span className="block font-semibold text-brand-black">{cat.name}</span>
        {parent && <span className="block text-xs text-charcoal-soft">in {parent}</span>}
      </button>
    )
  }

  if (!open) {
    if (picked) {
      return (
        <div
          className="rounded-xl border border-hairline bg-pale-lavender p-4 flex flex-col gap-2"
          aria-live="polite"
        >
          <p className="font-subhead text-sm text-brand-black">
            We filled in <strong>{picked.categoryName}</strong> as a{' '}
            <strong>{GUIDE_TYPE_LABELS[picked.entityType]}</strong>
            {picked.locationType ? ', and where you work on the next step.' : '.'}
          </p>
          <p className="font-subhead text-xs text-charcoal-soft">
            {picked.reason} You can change any of it below.
          </p>
          {picked.categoryId === '' && (
            <p className="font-subhead text-xs text-charcoal-soft">
              Pick the subcategory that fits best below.
            </p>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="self-start font-subhead text-sm font-semibold text-amber underline underline-offset-2 min-h-11"
          >
            Change answers
          </button>
        </div>
      )
    }
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start font-subhead text-sm font-semibold text-amber underline underline-offset-2 min-h-11"
      >
        Not sure what to pick? Help me choose
      </button>
    )
  }

  return (
    <section
      aria-labelledby={`${ids}-title`}
      className="rounded-xl border border-hairline bg-pale-lavender p-4 sm:p-5 flex flex-col gap-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`${ids}-title`} className="font-headline text-lg text-brand-black">
            Let&apos;s find where you fit
          </h2>
          <p className="font-subhead text-sm text-charcoal-soft">
            Answer two quick questions, or type what you do.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-subhead text-sm text-charcoal underline underline-offset-2 min-h-11"
        >
          Skip, I&apos;ll pick myself
        </button>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor={`${ids}-search`}
          className="font-subhead text-sm font-semibold text-brand-black"
        >
          Type what you do
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-faint"
            aria-hidden="true"
          />
          <input
            id={`${ids}-search`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="barber, food truck, lawyer, candles"
            autoComplete="off"
            className="h-11 w-full rounded-lg border border-hairline bg-white pl-9 pr-3 font-subhead text-base text-brand-black focus:outline-none focus:ring-2 focus:ring-amber"
          />
        </div>
        {query.trim() !== '' && (
          <div aria-live="polite">
            {results.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {results.map((cat) => renderCategory(cat, 'search'))}
              </div>
            ) : (
              <p className="font-subhead text-sm text-charcoal-soft">
                No match yet. Try another word, or answer the questions below.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Question 1 */}
      <fieldset className="flex flex-col gap-2">
        <legend className="font-subhead text-sm font-semibold text-brand-black mb-2">
          What do customers come to you for?
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {GUIDE_ANSWERS.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={answerId === a.id}
              onClick={() => {
                setAnswerId(a.id)
                setShowMore(false)
              }}
              className={cn(chip, answerId === a.id ? chipOn : chipOff)}
            >
              <span className="block font-semibold">{a.label}</span>
              <span
                className={cn(
                  'block text-xs',
                  answerId === a.id ? 'text-white/80' : 'text-charcoal-soft'
                )}
              >
                {a.hint}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Question 2 */}
      {answer && (
        <fieldset className="flex flex-col gap-2">
          <legend className="font-subhead text-sm font-semibold text-brand-black mb-2">
            Where do they get it?
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {GUIDE_WHERE.map((w) => (
              <button
                key={w.id}
                type="button"
                aria-pressed={whereId === w.id}
                onClick={() => setWhereId(w.id)}
                className={cn(chip, whereId === w.id ? chipOn : chipOff)}
              >
                <span className="block font-semibold">{w.label}</span>
                <span
                  className={cn(
                    'block text-xs',
                    whereId === w.id ? 'text-white/80' : 'text-charcoal-soft'
                  )}
                >
                  {w.hint}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {/* Question 3 */}
      {suggestions && suggestions.best.length > 0 && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="font-subhead text-sm font-semibold text-brand-black">
            Which fits best?
            {findWhere(whereId) ? null : (
              <span className="font-normal text-charcoal-soft">
                {' '}
                Answer the question above to sort these.
              </span>
            )}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {suggestions.best.map((cat) => renderCategory(cat, 'questions'))}
            {showMore && suggestions.more.map((cat) => renderCategory(cat, 'questions'))}
          </div>
          {suggestions.more.length > 0 && !showMore && (
            <button
              type="button"
              onClick={() => setShowMore(true)}
              className="self-start font-subhead text-sm font-semibold text-amber underline underline-offset-2 min-h-11"
            >
              More options ({suggestions.more.length})
            </button>
          )}
          <p className="font-subhead text-xs text-charcoal-soft">
            None of these? Skip and pick from the full list below.
          </p>
        </div>
      )}
    </section>
  )
}
