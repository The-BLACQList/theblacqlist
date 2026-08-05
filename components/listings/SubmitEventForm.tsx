'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import { createListingAction } from '@/lib/actions/listings/createListing'
import { cn } from '@/lib/utils'
import type { CategoryOption } from '@/app/add-business/page'

interface Props {
  categories: CategoryOption[]
}

export function SubmitEventForm({ categories }: Props) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(createListingAction, null)
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    if (state && 'success' in state) {
      router.push(`/dashboard/pages/${state.listingId}/edit`)
    }
  }, [state, router])

  const fieldErr = (f: string) =>
    state && 'fieldErrors' in state ? state.fieldErrors?.[f] : undefined

  const inputCls = (f: string) =>
    cn(
      'h-11 w-full rounded-lg border bg-white font-subhead text-sm text-brand-black px-3',
      'placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black',
      fieldErr(f) ? 'border-red-400' : 'border-charcoal/30'
    )

  const labelCls = 'font-subhead text-sm font-semibold text-brand-black'
  const errCls = 'text-xs font-subhead text-red-600 mt-0.5'

  return (
    <form action={formAction} className="bg-white rounded-2xl border border-charcoal/10 p-6 flex flex-col gap-5">
      <input type="hidden" name="entity_type" value="event" />
      {/* Events center a Black-owned business or creator (see attestation below),
          so they carry the black_owned ownership label. */}
      <input type="hidden" name="ownership_label" value="black_owned" />

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className={labelCls}>
          Event name <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <input id="name" name="name" type="text" maxLength={120} required className={inputCls('name')} placeholder="e.g. Juneteenth Block Party" />
        {fieldErr('name') && <p role="alert" className={errCls}>{fieldErr('name')}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tagline" className={labelCls}>
          Short description <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <input id="tagline" name="tagline" type="text" maxLength={120} required className={inputCls('tagline')} placeholder="One line shown on event cards (10–120 chars)" />
        {fieldErr('tagline') && <p role="alert" className={errCls}>{fieldErr('tagline')}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="category_id" className={labelCls}>
          Category <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <select
          id="category_id"
          name="category_id"
          required
          defaultValue=""
          className={cn(inputCls('category_id'), 'appearance-none cursor-pointer')}
        >
          <option value="" disabled>Select a category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {fieldErr('category_id') && <p role="alert" className={errCls}>{fieldErr('category_id')}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="starts_at" className={labelCls}>
            Starts <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <input id="starts_at" name="starts_at" type="datetime-local" required className={inputCls('starts_at')} />
          {fieldErr('starts_at') && <p role="alert" className={errCls}>{fieldErr('starts_at')}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ends_at" className={labelCls}>
            Ends <span className="font-normal text-charcoal-soft text-xs">(optional)</span>
          </label>
          <input id="ends_at" name="ends_at" type="datetime-local" className={inputCls('ends_at')} />
          {fieldErr('ends_at') && <p role="alert" className={errCls}>{fieldErr('ends_at')}</p>}
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
        <span className="font-subhead text-sm text-brand-black">This is an online event</span>
      </label>

      {!isOnline && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="venue_name" className={labelCls}>
              Venue name <span className="text-red-500" aria-hidden="true">*</span>
            </label>
            <input id="venue_name" name="venue_name" type="text" className={inputCls('venue_name')} placeholder="e.g. The Met Atlanta" />
            {fieldErr('venue_name') && <p role="alert" className={errCls}>{fieldErr('venue_name')}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="venue_address" className={labelCls}>
              Venue address <span className="font-normal text-charcoal-soft text-xs">(optional)</span>
            </label>
            <input id="venue_address" name="venue_address" type="text" className={inputCls('venue_address')} placeholder="Street, city" />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="city_text" className={labelCls}>City</label>
          <input id="city_text" name="city_text" type="text" className={inputCls('city_text')} placeholder="Atlanta" />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="state_text" className={labelCls}>State</label>
          <input id="state_text" name="state_text" type="text" maxLength={2} className={inputCls('state_text')} placeholder="GA" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="ticket_url" className={labelCls}>
            Ticket / RSVP link <span className="font-normal text-charcoal-soft text-xs">(optional)</span>
          </label>
          <input id="ticket_url" name="ticket_url" type="url" className={inputCls('ticket_url')} placeholder="https://…" />
          {fieldErr('ticket_url') && <p role="alert" className={errCls}>{fieldErr('ticket_url')}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="price_text" className={labelCls}>
            Price <span className="font-normal text-charcoal-soft text-xs">(optional)</span>
          </label>
          <input id="price_text" name="price_text" type="text" className={inputCls('price_text')} placeholder="Free · $20 · $10–$50" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className={labelCls}>
          About this event <span className="text-red-500" aria-hidden="true">*</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={5}
          maxLength={2000}
          required
          className={cn(
            'w-full rounded-lg border bg-white font-subhead text-sm text-brand-black px-3 py-2.5 resize-none',
            'placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black',
            fieldErr('description') ? 'border-red-400' : 'border-charcoal/30'
          )}
          placeholder="What's happening, who it's for, and what to expect. 20–2000 characters."
        />
        {fieldErr('description') && <p role="alert" className={errCls}>{fieldErr('description')}</p>}
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" name="ownership_attested" value="true" required className="mt-0.5 h-4 w-4 rounded border-charcoal/30 accent-brand-black" />
        <span className="font-subhead text-xs text-charcoal leading-relaxed">
          This event is hosted by or centers a Black-owned business or Black creator, consistent with The BLACQList&apos;s listing criteria.
        </span>
      </label>

      {state && 'error' in state && (
        <div role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
          <p className="font-subhead text-sm text-red-700">{state.error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 h-12 rounded-full bg-amber-gold text-brand-black font-subhead text-sm font-bold hover:bg-amber-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isPending ? 'Creating…' : 'Create event draft'}
      </button>
      <p className="font-subhead text-xs text-charcoal-soft text-center">
        You&apos;ll land on the event editor next, where you can add photos and submit it for review.
      </p>
    </form>
  )
}
