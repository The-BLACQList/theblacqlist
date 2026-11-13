'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { useSaveLabel } from './SaveLabel'
import { Loader2, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react'
import { updateCtaAction } from '@/lib/actions/dashboard/updateCta'
import { CollectiveSubmit, useSectionSave } from '@/components/listings/finish/ProfileSave'
import { InboxSwitch } from './InboxSwitch'
import { OWNER_INBOX_PATH } from '@/lib/messaging/constants'

interface Props {
  listingId: string
  ctaType: string | null
  ctaUrl: string | null
  ctaLabelOverride: string | null
  /**
   * This page's inbox switch. undefined while messaging is off (or the read
   * failed): the section then hides the inbox and the "Message us" type.
   */
  inbox?: { open: boolean }
}

const CTA_OPTIONS: { value: string; label: string; requiresUrl: boolean }[] = [
  { value: 'book', label: 'Book an appointment', requiresUrl: true },
  { value: 'order', label: 'Order now', requiresUrl: true },
  { value: 'call', label: 'Call us', requiresUrl: false },
  { value: 'message', label: 'Message us (your inbox)', requiresUrl: false },
  { value: 'email', label: 'Email us', requiresUrl: true },
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function CtaSection({ listingId, ctaType, ctaUrl, ctaLabelOverride, inbox }: Props) {
  const {
    state,
    pending: isPending,
    collective,
    formProps,
  } = useSectionSave({
    id: 'main-button',
    label: 'Main button',
    action: updateCtaAction,
  })
  const saveLabel = useSaveLabel()
  // Before "Email us" existed, "Send a message" held an email address. Such a
  // button still works as an email button, so it opens as one here.
  const legacyEmail = ctaType === 'message' && !!ctaUrl && EMAIL_RE.test(ctaUrl)
  const [selectedType, setSelectedType] = useState(legacyEmail ? 'email' : (ctaType ?? ''))
  const [inboxOpen, setInboxOpen] = useState(inbox?.open ?? false)

  // "Message us" needs the inbox, so it is offered only while messaging is on
  // (and kept for a page that already has it).
  const options = CTA_OPTIONS.filter((o) => o.value !== 'message' || inbox || ctaType === 'message')
  const selectedOption = CTA_OPTIONS.find((o) => o.value === selectedType)
  const requiresUrl = selectedOption?.requiresUrl ?? true
  const isEmail = selectedType === 'email'

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Main button</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          The main button shown on your public page. Choose the action that best fits your business.
        </p>
      </div>
      <form {...formProps} className="px-5 py-4 space-y-4">
        <input type="hidden" name="listing_id" value={listingId} />

        <div>
          <label
            htmlFor="cta-type"
            className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
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
            {options.map((opt) => (
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
              className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
            >
              {isEmail ? 'Email address' : 'Destination URL'}{' '}
              <span aria-hidden="true">*</span>
            </label>
            <input
              key={isEmail ? 'email' : 'url'}
              id="cta-url"
              name="cta_url"
              type={isEmail ? 'email' : 'url'}
              autoComplete={isEmail ? 'email' : 'url'}
              defaultValue={isEmail === EMAIL_RE.test(ctaUrl ?? '') ? (ctaUrl ?? '') : ''}
              placeholder={isEmail ? 'you@yourbusiness.com' : 'https://example.com/book'}
              required={requiresUrl}
              className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="cta-label"
            className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
          >
            Button label override{' '}
            <span className="font-normal text-charcoal-faint">(optional, max 50 chars)</span>
          </label>
          <input
            id="cta-label"
            name="cta_label_override"
            type="text"
            defaultValue={ctaLabelOverride ?? ''}
            maxLength={50}
            placeholder="Leave blank to use the default label"
            className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
        </div>

        {selectedType === 'message' && inbox && !inboxOpen && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 font-body text-sm text-amber-900"
          >
            <AlertCircle className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
            Your inbox is off, so this button shows &ldquo;Not accepting messages&rdquo;. Turn the inbox on below, or
            pick Email us.
          </p>
        )}

        {state && 'error' in state && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2"
          >
            <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-red-700">{state.error}</p>
          </div>
        )}
        {!collective && state && 'success' in state && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
            <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-green-700">Saved.</p>
          </div>
        )}

        {collective ? (
          <CollectiveSubmit />
        ) : (
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isPending ? 'Saving…' : saveLabel}
            </button>
          </div>
        )}
      </form>

      {inbox && (
        <div className="px-5 py-4 border-t border-charcoal/8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="flex items-center gap-2 font-subhead text-sm font-bold text-brand-black">
              <MessageCircle className="size-4 text-amber-700" aria-hidden="true" />
              Inbox
            </h3>
            <span className="flex items-center gap-3">
              <Link
                href={`${OWNER_INBOX_PATH}?listing=${listingId}` as Route}
                className="font-subhead text-xs font-semibold text-brand-black underline underline-offset-2 hover:text-charcoal"
              >
                Go to inbox
              </Link>
              <Link
                href={`${OWNER_INBOX_PATH}/settings` as Route}
                className="font-subhead text-xs font-semibold text-brand-black underline underline-offset-2 hover:text-charcoal"
              >
                Inbox settings
              </Link>
            </span>
          </div>
          <InboxSwitch
            listingId={listingId}
            initialOpen={inbox.open}
            label="Let customers message this page"
            onSaved={setInboxOpen}
          />
        </div>
      )}
    </div>
  )
}
