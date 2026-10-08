'use client'

import { useState } from 'react'
import type { ChecklistResult } from '@/lib/ai/checklist'
import { cn } from '@/lib/utils'

// Short labels and anchors for the finish view (tickets 126 and 129). The
// checklist's own labels are written for the dashboard suggestions page.
export const FINISH_ITEMS: Record<string, { label: string; anchor: string }> = {
  tagline: { label: 'One-line tagline', anchor: '#basics' },
  description: { label: 'About, 100+ characters', anchor: '#about' },
  logo: { label: 'A photo', anchor: '#photos' },
  cover: { label: 'Cover photo', anchor: '#photos' },
  gallery: { label: 'A second photo', anchor: '#photos' },
  cta: { label: 'Main button', anchor: '#main-button' },
  contact: { label: 'Phone or website', anchor: '#contact' },
  hours: { label: 'Hours', anchor: '#hours' },
  social: { label: 'A social link', anchor: '#social' },
  service: { label: 'A service', anchor: '#services' },
  meta_title: { label: 'Search title', anchor: '#google' },
  meta_description: { label: 'Search description', anchor: '#google' },
  niche: { label: 'A niche', anchor: '#details' },
  sample: { label: 'A sample post or video', anchor: '#video' },
}

export function itemLabel(id: string, fallback: string): string {
  return FINISH_ITEMS[id]?.label ?? fallback
}

interface Props {
  checklist: ChecklistResult
}

export function StrengthMeter({ checklist }: Props) {
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
              aria-label={`${itemLabel(item.id, item.label)}: ${item.passed ? 'done' : 'not yet'}`}
              aria-pressed={activeId === item.id}
              onClick={() => setActiveId((cur) => (cur === item.id ? null : item.id))}
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
          'Tap a bar to see what it stands for.'
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
