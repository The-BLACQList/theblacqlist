'use client'

import { useActionState, useState } from 'react'
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { updateEventDetailsAction } from '@/lib/actions/dashboard/updateEventDetails'

interface EventValues {
  starts_at: string | null
  ends_at: string | null
  is_online: boolean
  venue_name: string | null
  venue_address: string | null
  city_text: string | null
  state: string | null
  ticket_url: string | null
  price_text: string | null
  description: string | null
  organizer_listing_id: string | null
}

interface Props {
  listingId: string
  event: EventValues | null
  businesses: { id: string; name: string }[]
}

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40'
const labelCls = 'block font-subhead text-xs font-semibold text-charcoal-soft mb-1'

export function EventDetailsSection({ listingId, event, businesses }: Props) {
  const [state, formAction, isPending] = useActionState(updateEventDetailsAction, null)
  const [isOnline, setIsOnline] = useState(event?.is_online ?? false)

  const fieldErr = (f: string) => (state && 'field' in state && state.field === f ? state.error : null)

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Event details</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          When and where your event happens, plus ticketing.
        </p>
      </div>

      <form action={formAction} className="px-5 py-4 space-y-4">
        <input type="hidden" name="listing_id" value={listingId} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="ev-starts" className={labelCls}>
              Starts
            </label>
            <input
              id="ev-starts"
              name="starts_at"
              type="datetime-local"
              required
              defaultValue={toLocalInput(event?.starts_at ?? null)}
              className={inputCls}
            />
            {fieldErr('starts_at') && (
              <p role="alert" className="font-body text-xs text-red-600 mt-0.5">
                {fieldErr('starts_at')}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="ev-ends" className={labelCls}>
              Ends <span className="font-normal text-charcoal-faint">(optional)</span>
            </label>
            <input
              id="ev-ends"
              name="ends_at"
              type="datetime-local"
              defaultValue={toLocalInput(event?.ends_at ?? null)}
              className={inputCls}
            />
            {fieldErr('ends_at') && (
              <p role="alert" className="font-body text-xs text-red-600 mt-0.5">
                {fieldErr('ends_at')}
              </p>
            )}
          </div>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            name="is_online"
            value="true"
            checked={isOnline}
            onChange={(e) => setIsOnline(e.target.checked)}
            className="h-4 w-4 rounded border-charcoal/30 accent-brand-black"
          />
          <span className="font-body text-sm text-brand-black">This is an online event</span>
        </label>

        {!isOnline && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ev-venue" className={labelCls}>
                Venue name
              </label>
              <input
                id="ev-venue"
                name="venue_name"
                type="text"
                defaultValue={event?.venue_name ?? ''}
                className={inputCls}
                placeholder="e.g. The Met Atlanta"
              />
              {fieldErr('venue_name') && (
                <p role="alert" className="font-body text-xs text-red-600 mt-0.5">
                  {fieldErr('venue_name')}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="ev-venue-addr" className={labelCls}>
                Venue address
              </label>
              <input
                id="ev-venue-addr"
                name="venue_address"
                type="text"
                defaultValue={event?.venue_address ?? ''}
                className={inputCls}
                placeholder="Street, city"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="ev-city" className={labelCls}>
              City
            </label>
            <input
              id="ev-city"
              name="city_text"
              type="text"
              defaultValue={event?.city_text ?? ''}
              className={inputCls}
              placeholder="Atlanta"
            />
          </div>
          <div>
            <label htmlFor="ev-state" className={labelCls}>
              State
            </label>
            <input
              id="ev-state"
              name="state_text"
              type="text"
              maxLength={2}
              defaultValue={event?.state ?? ''}
              className={inputCls}
              placeholder="GA"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="ev-ticket" className={labelCls}>
              Ticket / RSVP link
            </label>
            <input
              id="ev-ticket"
              name="ticket_url"
              type="url"
              defaultValue={event?.ticket_url ?? ''}
              className={inputCls}
              placeholder="https://…"
            />
            {fieldErr('ticket_url') && (
              <p role="alert" className="font-body text-xs text-red-600 mt-0.5">
                {fieldErr('ticket_url')}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="ev-price" className={labelCls}>
              Price
            </label>
            <input
              id="ev-price"
              name="price_text"
              type="text"
              defaultValue={event?.price_text ?? ''}
              className={inputCls}
              placeholder="Free · $20 · $10–$50"
            />
          </div>
        </div>

        {businesses.length > 0 && (
          <div>
            <label htmlFor="ev-organizer" className={labelCls}>
              Hosted by <span className="font-normal text-charcoal-faint">(optional)</span>
            </label>
            <select
              id="ev-organizer"
              name="organizer_listing_id"
              defaultValue={event?.organizer_listing_id ?? ''}
              className={`${inputCls} appearance-none cursor-pointer`}
            >
              <option value="">No linked business</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="ev-desc" className={labelCls}>
            About this event
          </label>
          <textarea
            id="ev-desc"
            name="description"
            rows={4}
            maxLength={2000}
            defaultValue={event?.description ?? ''}
            className={`${inputCls} resize-y`}
            placeholder="What's happening, who it's for, what to expect."
          />
        </div>

        {state && 'error' in state && !('field' in state && state.field) && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2"
          >
            <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-red-700">{state.error}</p>
          </div>
        )}
        {state && 'success' in state && (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="size-4 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm">Saved.</p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isPending ? 'Saving…' : 'Save event details'}
          </button>
        </div>
      </form>
    </div>
  )
}
