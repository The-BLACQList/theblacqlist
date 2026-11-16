'use client'

import { useState, useTransition } from 'react'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  deleteHoursOverrideAction,
  saveHoursOverrideAction,
  type HoursOverridesState,
} from '@/lib/actions/dashboard/hoursOverrides'
import {
  HOURS_OVERRIDE_LABEL_MAX,
  HOURS_OVERRIDE_MAX,
  HOURS_OVERRIDE_MAX_AHEAD_DAYS,
  formatOverrideDate,
  futureDateKey,
  localDateKey,
} from '@/lib/listings/hoursOverrides'
import { formatTime } from '@/lib/listings/openStatus'
import type { HoursOverride } from '@/types'

// Holiday and special hours (ticket 196), the owner's side: the dates set,
// soonest first, with Edit and Remove, and one form for adding or editing a
// date. A date set here replaces that day's weekly hours on the page.

interface Props {
  listingId: string
  initial: HoursOverride[]
}

interface Draft {
  /** The date as saved, when editing; null for a new one. */
  savedDate: string | null
  date: string
  closed: boolean
  open: string
  close: string
  label: string
}

const INPUT =
  'w-full px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40'
const LABEL = 'block font-subhead text-xs font-semibold text-charcoal-soft mb-1'
const ICON_BUTTON =
  'inline-flex items-center justify-center size-8 rounded-full border border-charcoal/15 bg-white text-charcoal disabled:opacity-40'

function hoursText(o: HoursOverride): string {
  if (o.closed) return 'Closed'
  return o.open && o.close ? `${formatTime(o.open)} – ${formatTime(o.close)}` : 'Hours vary'
}

export function HoursOverridesManager({ listingId, initial }: Props) {
  const [items, setItems] = useState(initial)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function run(action: () => Promise<HoursOverridesState>, after?: () => void) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if ('error' in result) {
        setError(result.error)
        return
      }
      setItems(result.items)
      after?.()
    })
  }

  const today = localDateKey(new Date())
  const shown = items.filter((o) => o.date >= today)
  const canAdd = shown.length < HOURS_OVERRIDE_MAX
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d))

  return (
    <section className="rounded-2xl border border-charcoal/10 bg-white p-5">
      {shown.length === 0 ? (
        <p className="font-body text-sm text-charcoal">
          Nothing planned. Add a holiday you&rsquo;re closed, or a day with different hours.
        </p>
      ) : (
        <ul className="divide-y divide-charcoal/10">
          {shown.map((o) => (
            <li key={o.date} className="flex items-center gap-3 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-subhead text-sm font-semibold text-brand-black">
                  <time dateTime={o.date}>{formatOverrideDate(o.date)}</time>
                  {o.label && <span className="font-normal text-charcoal-soft"> · {o.label}</span>}
                </p>
                <p className="font-body text-xs text-charcoal-soft">{hoursText(o)}</p>
              </div>
              <button
                type="button"
                className={ICON_BUTTON}
                disabled={isPending}
                onClick={() => {
                  setError(null)
                  setDraft({
                    savedDate: o.date,
                    date: o.date,
                    closed: o.closed,
                    open: o.open ?? '09:00',
                    close: o.close ?? '17:00',
                    label: o.label ?? '',
                  })
                }}
                aria-label={`Edit ${formatOverrideDate(o.date)}`}
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className={ICON_BUTTON}
                disabled={isPending}
                onClick={() =>
                  run(
                    () => deleteHoursOverrideAction({ listingId, date: o.date }),
                    () => setDraft((d) => (d?.savedDate === o.date ? null : d))
                  )
                }
                aria-label={`Remove ${formatOverrideDate(o.date)}`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {!draft && canAdd && (
        <button
          type="button"
          onClick={() => {
            setError(null)
            setDraft({
              savedDate: null,
              date: '',
              closed: true,
              open: '09:00',
              close: '17:00',
              label: '',
            })
          }}
          className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-brand-black text-white font-subhead text-sm font-bold"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add Special Hours
        </button>
      )}
      {!draft && !canAdd && (
        <p className="mt-4 font-body text-sm text-charcoal">
          You can plan up to {HOURS_OVERRIDE_MAX} special days. Remove one to add another.
        </p>
      )}

      {draft && (
        <form
          className="mt-5 border-t border-charcoal/10 pt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            const d = draft
            run(
              () =>
                saveHoursOverrideAction({
                  listingId,
                  date: d.date,
                  closed: d.closed,
                  open: d.closed ? null : d.open,
                  close: d.closed ? null : d.close,
                  label: d.label,
                  previousDate: d.savedDate,
                }),
              () => setDraft(null)
            )
          }}
        >
          <div>
            <label htmlFor="ho-date" className={LABEL}>
              Date
            </label>
            <input
              id="ho-date"
              type="date"
              className={`${INPUT} h-10 sm:w-56`}
              required
              min={today}
              max={futureDateKey(new Date(), HOURS_OVERRIDE_MAX_AHEAD_DAYS)}
              value={draft.date}
              onChange={(e) => set({ date: e.target.value })}
            />
          </div>
          <fieldset>
            <legend className={LABEL}>Hours That Day</legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 font-body text-sm text-brand-black">
                <input
                  type="radio"
                  name="ho-closed"
                  checked={draft.closed}
                  onChange={() => set({ closed: true })}
                />
                Closed All Day
              </label>
              <label className="flex items-center gap-2 font-body text-sm text-brand-black">
                <input
                  type="radio"
                  name="ho-closed"
                  checked={!draft.closed}
                  onChange={() => set({ closed: false })}
                />
                Open, Different Hours
              </label>
            </div>
          </fieldset>
          {!draft.closed && (
            <div className="flex items-center gap-2">
              <input
                type="time"
                aria-label="Opening time"
                required
                className={`${INPUT} h-10 w-32`}
                value={draft.open}
                onChange={(e) => set({ open: e.target.value })}
              />
              <span className="font-body text-xs text-charcoal-faint">–</span>
              <input
                type="time"
                aria-label="Closing time"
                required
                className={`${INPUT} h-10 w-32`}
                value={draft.close}
                onChange={(e) => set({ close: e.target.value })}
              />
            </div>
          )}
          <div>
            <label htmlFor="ho-label" className={LABEL}>
              Reason (Optional)
            </label>
            <input
              id="ho-label"
              className={`${INPUT} h-10`}
              maxLength={HOURS_OVERRIDE_LABEL_MAX}
              placeholder={draft.closed ? 'Thanksgiving' : 'Open late for the market'}
              value={draft.label}
              onChange={(e) => set({ label: e.target.value })}
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-brand-black text-white font-subhead text-sm font-bold disabled:opacity-50"
            >
              {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {draft.savedDate ? 'Save Changes' : 'Add Date'}
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
  )
}
