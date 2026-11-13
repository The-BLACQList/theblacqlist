'use client'

import { useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { EDIT_TABS, tabsWithChanges, type EditTabId } from '@/lib/listings/editTabs'
import { useChangedCards } from './ProfileSave'

// The tab row on the owner edit page (part C). A plain ARIA tablist: arrow
// keys move between tabs and open them, Home and End jump to the ends, and
// only the open tab is in the Tab order. A dot marks a tab with unsaved
// changes, so nothing is forgotten behind a closed tab.

export function tabId(id: EditTabId): string {
  return `edit-tab-${id}`
}

export function panelId(id: EditTabId): string {
  return `edit-panel-${id}`
}

interface Props {
  active: EditTabId
  onSelect: (id: EditTabId) => void
}

export function EditTabs({ active, onSelect }: Props) {
  const changed = tabsWithChanges(useChangedCards())
  const refs = useRef<Partial<Record<EditTabId, HTMLButtonElement | null>>>({})

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const i = EDIT_TABS.findIndex((t) => t.id === active)
    const last = EDIT_TABS.length - 1
    const next =
      e.key === 'ArrowRight'
        ? (i + 1) % EDIT_TABS.length
        : e.key === 'ArrowLeft'
          ? (i - 1 + EDIT_TABS.length) % EDIT_TABS.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null
    if (next === null) return
    e.preventDefault()
    const tab = EDIT_TABS[next]
    if (!tab) return
    onSelect(tab.id)
    refs.current[tab.id]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="Edit your page"
      onKeyDown={onKeyDown}
      className="sticky top-2 z-10 flex gap-1 overflow-x-auto rounded-xl border border-charcoal/10 bg-white p-1 shadow-sm"
    >
      {EDIT_TABS.map((t) => {
        const selected = t.id === active
        const dirty = changed.has(t.id)
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el
            }}
            type="button"
            role="tab"
            id={tabId(t.id)}
            aria-selected={selected}
            aria-controls={panelId(t.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(t.id)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 font-subhead text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60',
              selected
                ? 'bg-brand-black text-white'
                : 'text-charcoal-soft hover:bg-charcoal/5 hover:text-brand-black'
            )}
          >
            {t.label}
            {dirty && (
              <>
                <span
                  aria-hidden="true"
                  className={cn('size-1.5 rounded-full', selected ? 'bg-amber-gold' : 'bg-amber')}
                />
                <span className="sr-only">(unsaved changes)</span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
