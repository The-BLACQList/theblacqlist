'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { updateListingContentAction } from '@/lib/actions/dashboard/updateListingContent'

type Day = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
type DayHours = { open: string; close: string; closed: boolean }
type WeeklyHours = Record<Day, DayHours>

const DAYS: { key: Day; label: string }[] = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
]

const DEFAULT_DAY: DayHours = { open: '09:00', close: '17:00', closed: false }

function buildDefault(existing: Partial<WeeklyHours> | null): WeeklyHours {
  const out = {} as WeeklyHours
  for (const { key } of DAYS) {
    out[key] = existing?.[key] ?? { ...DEFAULT_DAY }
  }
  return out
}

interface Props {
  listingId: string
  hours: Partial<WeeklyHours> | null
}

export function HoursSection({ listingId, hours: initialHours }: Props) {
  const [hours, setHours] = useState<WeeklyHours>(() => buildDefault(initialHours))
  const [state, formAction, isPending] = useActionState(updateListingContentAction, null)

  function setDay(day: Day, patch: Partial<DayHours>) {
    setHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }))
  }

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Hours</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          Set your weekly hours. These appear on your public page.
        </p>
      </div>

      <form action={formAction} className="px-5 py-4 space-y-3">
        <input type="hidden" name="listing_id" value={listingId} />
        <input type="hidden" name="hours" value={JSON.stringify(hours)} />

        <div className="space-y-2">
          {DAYS.map(({ key, label }) => {
            const day = hours[key]
            return (
              <div key={key} className="flex items-center gap-3 min-h-[36px]">
                <span className="font-subhead text-xs font-semibold text-charcoal-soft w-7 shrink-0">
                  {label}
                </span>

                <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                  <input
                    type="checkbox"
                    checked={day.closed}
                    onChange={(e) => setDay(key, { closed: e.target.checked })}
                    aria-label={`Mark ${label} as closed`}
                    className="size-3.5 accent-charcoal"
                  />
                  <span className="font-body text-xs text-charcoal-soft">Closed</span>
                </label>

                {!day.closed && (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={day.open}
                      onChange={(e) => setDay(key, { open: e.target.value })}
                      aria-label={`${label} opening time`}
                      className="w-28 px-2 py-1.5 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
                    />
                    <span className="font-body text-xs text-charcoal-faint">–</span>
                    <input
                      type="time"
                      value={day.close}
                      onChange={(e) => setDay(key, { close: e.target.value })}
                      aria-label={`${label} closing time`}
                      className="w-28 px-2 py-1.5 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {state && 'error' in state && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2"
          >
            <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-red-700">{state.error}</p>
          </div>
        )}
        {state && 'success' in state && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
            <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-green-700">Hours saved.</p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isPending ? 'Saving…' : 'Save hours'}
          </button>
        </div>
      </form>
    </div>
  )
}
