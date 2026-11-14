'use client'

import { useState } from 'react'
import type { ChecklistResult } from '@/lib/ai/checklist'
import { FINISH_ITEMS, itemLabel } from '@/lib/listings/finishItems'
import { cn } from '@/lib/utils'

// The labels and anchors live in lib/listings/finishItems.ts so the owner Cue
// (ticket 203) can read them on the server.
export { FINISH_ITEMS, itemLabel } from '@/lib/listings/finishItems'

const HIGHLIGHT = ['ring-2', 'ring-amber-gold', 'ring-offset-4']

// Scrolls to an item's section, moves focus there so the next Tab lands on
// its first field, and rings it for a moment so the eye can find it. On the
// edit page the section may sit in a closed tab, so `show` opens it first.
function goToSection(id: string, show?: (anchorId: string) => void): void {
  const anchor = FINISH_ITEMS[id]?.anchor ?? '#basics'
  show?.(anchor.slice(1))
  const el = document.querySelector<HTMLElement>(anchor)
  if (!el) return
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  el.focus({ preventScroll: true })
  history.replaceState(null, '', anchor)
  el.classList.add(...HIGHLIGHT)
  window.setTimeout(() => el.classList.remove(...HIGHLIGHT), 1600)
}

interface Props {
  checklist: ChecklistResult
  /** Makes a section visible before the meter scrolls to it (opens its tab). Runs synchronously. */
  showSection?: (anchorId: string) => void
}

export function StrengthMeter({ checklist, showSection }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const done = checklist.items.filter((i) => i.passed).length
  const missing = checklist.items.filter((i) => !i.passed)
  const active = checklist.items.find((i) => i.id === activeId) ?? null

  return (
    <section
      aria-labelledby="strength-heading"
      className="rounded-xl border border-charcoal/10 bg-white px-5 py-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="strength-heading" className="font-headline text-base text-brand-black">
          Page strength
        </h2>
        <p className="font-subhead text-sm text-charcoal tabular-nums">
          <span className="font-bold text-brand-black">{checklist.percent}%</span> · {done} of{' '}
          {checklist.items.length} done
        </p>
      </div>

      <ul className="mt-3 flex gap-1" aria-label="Page strength checklist">
        {checklist.items.map((item) => (
          <li key={item.id} className="min-w-0 flex-1">
            <button
              type="button"
              aria-label={`${itemLabel(item.id, item.label)}: ${item.passed ? 'done' : 'not yet'}. Go to this part of your page.`}
              onClick={() => {
                setActiveId(item.id)
                goToSection(item.id, showSection)
              }}
              onMouseEnter={() => setActiveId(item.id)}
              onFocus={() => setActiveId(item.id)}
              className="group flex h-8 w-full items-center rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-gold"
            >
              <span
                aria-hidden="true"
                className={cn(
                  'block h-2 w-full rounded-full transition-colors',
                  item.passed ? 'bg-amber-gold' : 'bg-charcoal/12 group-hover:bg-charcoal/25'
                )}
              />
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-1 min-h-10 font-body text-xs text-charcoal-soft" aria-live="polite">
        {active ? (
          <>
            <span className="font-semibold text-brand-black">
              {itemLabel(active.id, active.label)}
              {active.passed ? ', done. ' : '. '}
            </span>
            {!active.passed && active.hint}
          </>
        ) : (
          'Tap a bar to go to that part of your page.'
        )}
      </p>

      {missing.length > 0 && (
        <div className="mt-2 border-t border-charcoal/8 pt-3">
          <p className="font-subhead text-xs font-semibold uppercase tracking-widest text-charcoal-soft">
            Still to add
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {missing.map((item) => (
              <li key={item.id}>
                <a
                  href={FINISH_ITEMS[item.id]?.anchor ?? '#basics'}
                  onClick={(e) => {
                    e.preventDefault()
                    goToSection(item.id, showSection)
                  }}
                  className="inline-flex min-h-9 items-center rounded-full border border-charcoal/15 px-3 font-subhead text-xs text-brand-black hover:border-amber-gold hover:bg-amber-gold/10"
                >
                  {itemLabel(item.id, item.label)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
