'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  deleteHighlightAction,
  reorderHighlightsAction,
  saveHighlightAction,
  setHighlightsKindAction,
  type HighlightsState,
} from '@/lib/actions/dashboard/highlights'
import {
  HIGHLIGHT_KINDS,
  HIGHLIGHT_KIND_LABEL,
  HIGHLIGHT_TEXT_MAX,
  HIGHLIGHT_TITLE_MAX,
  type HighlightKind,
  type OwnerHighlight,
} from '@/lib/listings/highlights'
import {
  HIGHLIGHT_ICONS,
  highlightIcon,
  type HighlightIconName,
} from '@/components/entity-page/highlightIcons'
import type { UpgradeTarget } from '@/lib/stripe/planChecks'
import { PlanLimitNote } from '@/components/dashboard/PlanLimitNote'

// Highlights and process steps (ticket 195), the owner's side: the page's
// style (icon bullets or numbered steps), the list in the page's order with
// Edit, Move Up/Down and Remove, and one form for adding or editing. The icon
// picker offers only the allow-list the page renders from.

interface Props {
  listingId: string
  initial: OwnerHighlight[]
  /** Items the page's plan shows: 0 on Free. */
  limit: number
  upgradeTo: UpgradeTarget
}

interface Draft {
  id: string | null
  icon: HighlightIconName | null
  title: string
  text: string
}

const EMPTY: Draft = { id: null, icon: null, title: '', text: '' }
const ICON_NAMES = Object.keys(HIGHLIGHT_ICONS) as HighlightIconName[]

const KIND_HINT: Record<HighlightKind, string> = {
  highlight: 'Icon bullets: what sets you apart.',
  step: 'Numbered steps: how working with you goes.',
}

const INPUT =
  'w-full px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40'
const LABEL = 'block font-subhead text-xs font-semibold text-charcoal-soft mb-1'
const ICON_BUTTON =
  'inline-flex items-center justify-center size-8 rounded-full border border-charcoal/15 bg-white text-charcoal disabled:opacity-40'

function iconLabel(name: string): string {
  return name.replace(/-/g, ' ')
}

export function HighlightsManager({ listingId, initial, limit, upgradeTo }: Props) {
  const [items, setItems] = useState(initial)
  const [kind, setKind] = useState<HighlightKind>(initial[0]?.kind ?? 'highlight')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function run(action: () => Promise<HighlightsState>, after?: () => void) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if ('error' in result) {
        setError(result.error)
        return
      }
      setItems(result.items)
      if (result.items[0]) setKind(result.items[0].kind)
      after?.()
    })
  }

  function move(index: number, by: -1 | 1) {
    const next = [...items]
    const [item] = next.splice(index, 1)
    if (!item) return
    next.splice(index + by, 0, item)
    run(() => reorderHighlightsAction({ listingId, ids: next.map((h) => h.id) }))
  }

  function pickKind(next: HighlightKind) {
    if (next === kind) return
    if (items.length === 0) {
      setKind(next)
      return
    }
    run(() => setHighlightsKindAction({ listingId, kind: next }))
  }

  const canAdd = items.length < limit
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  return (
    <div className="space-y-6">
      {limit === 0 && (
        <PlanLimitNote upgradeTo={upgradeTo}>
          Highlights come with Starter. Anything saved here stays, and shows again when your page is
          on Starter or higher.
        </PlanLimitNote>
      )}

      <fieldset className="rounded-2xl border border-charcoal/10 bg-white p-5">
        <legend className="px-1 font-subhead text-sm font-semibold text-brand-black">Style</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {HIGHLIGHT_KINDS.map((k) => (
            <label
              key={k}
              className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border p-4 ${
                kind === k ? 'border-brand-black bg-pale-lavender' : 'border-charcoal/15'
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="highlight-kind"
                  value={k}
                  checked={kind === k}
                  disabled={isPending}
                  onChange={() => pickKind(k)}
                />
                <span className="font-subhead text-sm font-semibold text-brand-black">
                  {HIGHLIGHT_KIND_LABEL[k]}
                </span>
              </span>
              <span className="pl-5 font-body text-xs text-charcoal-soft">{KIND_HINT[k]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <section className="rounded-2xl border border-charcoal/10 bg-white p-5">
        {items.length === 0 ? (
          <p className="font-body text-sm text-charcoal">
            {kind === 'step'
              ? 'Nothing yet. Add the first step of working with you.'
              : 'Nothing yet. Add three or four things that set you apart.'}
          </p>
        ) : (
          <ol className="divide-y divide-charcoal/10">
            {items.map((h, i) => {
              const Icon = highlightIcon(h.icon)
              return (
                <li key={h.id} className="flex items-center gap-3 py-3">
                  {kind === 'step' ? (
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-black font-headline text-sm text-gold">
                      {i + 1}
                    </span>
                  ) : (
                    <Icon className="size-5 shrink-0 text-charcoal-soft" aria-hidden="true" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-subhead text-sm font-semibold text-brand-black">{h.title}</p>
                    <p className="font-body text-xs text-charcoal-soft">
                      {[h.text, i >= limit ? 'Hidden on your plan' : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    disabled={isPending || i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={`Move ${h.title} up`}
                  >
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    disabled={isPending || i === items.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={`Move ${h.title} down`}
                  >
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    disabled={isPending}
                    onClick={() => {
                      setError(null)
                      setDraft({ id: h.id, icon: h.icon, title: h.title, text: h.text ?? '' })
                    }}
                    aria-label={`Edit ${h.title}`}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={ICON_BUTTON}
                    disabled={isPending}
                    onClick={() =>
                      run(
                        () => deleteHighlightAction({ listingId, id: h.id }),
                        () => setDraft((d) => (d?.id === h.id ? null : d))
                      )
                    }
                    aria-label={`Remove ${h.title}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ol>
        )}

        {!draft && canAdd && (
          <button
            type="button"
            onClick={() => {
              setError(null)
              setDraft(EMPTY)
            }}
            className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-brand-black text-white font-subhead text-sm font-bold"
          >
            <Plus className="size-4" aria-hidden="true" />
            {kind === 'step' ? 'Add a Step' : 'Add a Highlight'}
          </button>
        )}
        {!draft && limit > 0 && !canAdd && (
          <div className="mt-4">
            <PlanLimitNote upgradeTo={upgradeTo}>
              Your plan includes {limit} highlights. Remove one to add another.
            </PlanLimitNote>
          </div>
        )}

        {draft && (
          <form
            className="mt-5 border-t border-charcoal/10 pt-5 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              const d = draft
              run(
                () =>
                  saveHighlightAction({
                    listingId,
                    ...(d.id ? { id: d.id } : { kind }),
                    icon: d.icon,
                    title: d.title,
                    text: d.text,
                  }),
                () => setDraft(null)
              )
            }}
          >
            <div>
              <label htmlFor="hl-title" className={LABEL}>
                Title
              </label>
              <input
                id="hl-title"
                className={`${INPUT} h-10`}
                required
                maxLength={HIGHLIGHT_TITLE_MAX}
                placeholder={kind === 'step' ? 'Book a Consultation' : 'Roasted on Site'}
                value={draft.title}
                onChange={(e) => set({ title: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="hl-text" className={LABEL}>
                Description (Optional)
              </label>
              <textarea
                id="hl-text"
                className={`${INPUT} py-2`}
                rows={2}
                maxLength={HIGHLIGHT_TEXT_MAX}
                value={draft.text}
                onChange={(e) => set({ text: e.target.value })}
              />
            </div>
            <fieldset>
              <legend className={LABEL}>Icon (Optional)</legend>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={draft.icon === null}
                  onClick={() => set({ icon: null })}
                  className={`h-9 px-3 rounded-lg border font-body text-xs ${
                    draft.icon === null
                      ? 'border-brand-black bg-pale-lavender'
                      : 'border-charcoal/15 bg-white'
                  }`}
                >
                  None
                </button>
                {ICON_NAMES.map((name) => {
                  const Icon = HIGHLIGHT_ICONS[name]
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={draft.icon === name}
                      aria-label={iconLabel(name)}
                      title={iconLabel(name)}
                      onClick={() => set({ icon: name })}
                      className={`inline-flex size-9 items-center justify-center rounded-lg border ${
                        draft.icon === name
                          ? 'border-brand-black bg-pale-lavender'
                          : 'border-charcoal/15 bg-white'
                      }`}
                    >
                      <Icon className="size-4 text-charcoal" aria-hidden="true" />
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-brand-black text-white font-subhead text-sm font-bold disabled:opacity-50"
              >
                {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {draft.id ? 'Save Changes' : kind === 'step' ? 'Add Step' : 'Add Highlight'}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  setError(null)
                  setDraft(null)
                }}
                className="inline-flex items-center h-9 px-4 rounded-full border border-charcoal/20 bg-white text-charcoal font-subhead text-sm font-bold disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {error && (
          <p role="alert" className="mt-4 font-body text-sm text-red-700">
            {error}
          </p>
        )}
      </section>
    </div>
  )
}
