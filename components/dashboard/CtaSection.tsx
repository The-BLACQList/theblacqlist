'use client'

import { useActionState, useState } from 'react'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { updateCtaAction } from '@/lib/actions/dashboard/updateCta'

interface Props {
  listingId: string
  ctaType: string | null
  ctaUrl: string | null
  ctaLabelOverride: string | null
}

const CTA_OPTIONS: { value: string; label: string; requiresUrl: boolean }[] = [
  { value: 'book', label: 'Book an appointment', requiresUrl: true },
  { value: 'order', label: 'Order now', requiresUrl: true },
  { value: 'call', label: 'Call us', requiresUrl: false },
  { value: 'message', label: 'Send a message', requiresUrl: true },
  { value: 'visit', label: 'Visit us', requiresUrl: true },
  { value: 'get-quote', label: 'Get a quote', requiresUrl: true },
  { value: 'shop', label: 'Shop now', requiresUrl: true },
  { value: 'subscribe', label: 'Subscribe', requiresUrl: true },
  { value: 'contact', label: 'Contact us', requiresUrl: true },
  { value: 'commission', label: 'Commission work', requiresUrl: true },
  { value: 'inquire', label: 'Inquire', requiresUrl: true },
  { value: 'get-tickets', label: 'Get tickets', requiresUrl: true },
  { value: 'rsvp', label: 'RSVP', requiresUrl: true },
  { value: 'register', label: 'Register', requiresUrl: true },
  { value: 'learn-more', label: 'Learn more', requiresUrl: true },
  { value: 'apply', label: 'Apply now', requiresUrl: true },
  { value: 'buy-now', label: 'Buy now', requiresUrl: true },
]

export function CtaSection({ listingId, ctaType, ctaUrl, ctaLabelOverride }: Props) {
  const [state, formAction, isPending] = useActionState(updateCtaAction, null)
  const [selectedType, setSelectedType] = useState(ctaType ?? '')

  const selectedOption = CTA_OPTIONS.find((o) => o.value === selectedType)
  const requiresUrl = selectedOption?.requiresUrl ?? true

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Primary call to action</h2>
        <p className="font-body text-xs text-charcoal/50 mt-0.5">
          The main button shown on your public page. Choose the action that best fits your business.
        </p>
      </div>
      <form action={formAction} className="px-5 py-4 space-y-4">
        <input type="hidden" name="listing_id" value={listingId} />

        <div>
          <label
            htmlFor="cta-type"
            className="block font-subhead text-xs font-semibold text-charcoal/70 mb-1"
          >
            Action type <span aria-hidden="true">*</span>
          </label>
          <select
            id="cta-type"
            name="cta_type"
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40 bg-white"
          >
            <option value="" disabled>
              Select an action…
            </option>
            {CTA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {requiresUrl && (
          <div>
            <label
              htmlFor="cta-url"
              className="block font-subhead text-xs font-semibold text-charcoal/70 mb-1"
            >
              Destination URL <span aria-hidden="true">*</span>
            </label>
            <input
              id="cta-url"
              name="cta_url"
              type="url"
              defaultValue={ctaUrl ?? ''}
              placeholder="https://example.com/book"
              required={requiresUrl}
              className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="cta-label"
            className="block font-subhead text-xs font-semibold text-charcoal/70 mb-1"
          >
            Button label override{' '}
            <span className="font-normal text-charcoal/40">(optional, max 50 chars)</span>
          </label>
          <input
            id="cta-label"
            name="cta_label_override"
            type="text"
            defaultValue={ctaLabelOverride ?? ''}
            maxLength={50}
            placeholder="Leave blank to use the default label"
            className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
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
            <p className="font-body text-sm text-green-700">Saved.</p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
