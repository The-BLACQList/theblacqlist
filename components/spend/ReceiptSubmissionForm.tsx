'use client'

import { useActionState, useEffect, useState, useSyncExternalStore, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, Info, ChevronDown } from 'lucide-react'

import { createReceiptSubmissionAction } from '@/lib/actions/spend/createReceiptSubmission'
import type { ReceiptSubmissionState } from '@/lib/actions/spend/createReceiptSubmission'
import { updateReceiptSubmissionAction } from '@/lib/actions/spend/updateReceiptSubmission'
import {
  MAX_RECEIPT_AGE_DAYS,
  MAX_RECEIPT_AMOUNT_CENTS,
  PHOTO_REQUIRED_MESSAGE,
  localIsoDay,
  receiptDateBounds,
} from '@/lib/spend/receipt-input'
import { ListingCombobox } from './ListingCombobox'
import { ReceiptPhotoField, receiptFileProblem } from './ReceiptPhotoField'

const inputCls =
  'w-full h-11 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/60'
const textareaCls =
  'w-full px-3 py-2.5 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/60 resize-y'

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block font-subhead text-sm font-semibold text-brand-black">
        {label}
      </label>
      {hint && <p className="font-body text-xs text-charcoal-soft">{hint}</p>}
      {children}
      {error && (
        <p role="alert" className="font-body text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

const noopSubscribe = () => () => {}

/**
 * The values an existing receipt is loaded with. Its presence is what puts the
 * form in edit mode — there is no separate edit component, because two copies
 * of this form would drift and the edit copy is the one nobody would notice
 * drifting.
 */
export interface ReceiptFormDefaults {
  id: string
  rawBusinessName: string | null
  listing: { id: string; name: string; cityName: string | null } | null
  amountCents: number
  purchaseDate: string
  notes: string | null
  aggregateOptOut: boolean
  hasFile: boolean
  /** A rejected receipt: saving it sends it back for review (ticket 164). */
  needsFix?: boolean
}

export function ReceiptSubmissionForm({
  receipt,
  prefillListing = null,
}: {
  receipt?: ReceiptFormDefaults
  /** From `?listing=` on the new page ("I shopped here"). Ignored in edit mode. */
  prefillListing?: ReceiptFormDefaults['listing']
}) {
  const isEdit = receipt !== undefined
  const [state, formAction, isPending] = useActionState<ReceiptSubmissionState, FormData>(
    isEdit ? updateReceiptSubmissionAction : createReceiptSubmissionAction,
    null
  )
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [file, setFile] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  // The server's photo error belongs to the attempt that produced it. Once the
  // shopper picks or removes a photo it no longer describes what is on screen.
  const [photoErrorSeenFor, setPhotoErrorSeenFor] = useState<ReceiptSubmissionState>(null)
  const [photoFocusKey, setPhotoFocusKey] = useState(0)
  // The date limits follow the shopper's own calendar, which the server
  // render can't know. Rendered once on the server's clock, then again on the
  // device's after hydration (the date input is keyed on it so the default
  // really updates).
  const onDevice = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  )
  const dateBounds = receiptDateBounds(localIsoDay(new Date()))

  useEffect(() => {
    if (state && 'success' in state) {
      router.push(isEdit ? '/account/receipts?updated=true' : '/account/receipts?submitted=true')
    }
  }, [state, router, isEdit])

  const fieldErrors = state && 'fieldErrors' in state && state.fieldErrors ? state.fieldErrors : {}
  const serverPhotoError = photoErrorSeenFor === state ? undefined : fieldErrors.receipt_file
  const needsPhoto = !isEdit || !receipt.hasFile

  function choosePhoto(next: File | null) {
    setFile(next)
    setPhotoError(next ? receiptFileProblem(next) : null)
    setPhotoErrorSeenFor(state)
  }

  // Submitted by hand rather than through `<form action>`: React resets a
  // form's fields after an action runs, and a server refusal must keep
  // everything the shopper typed (ticket 162). The photo is held in state for
  // the same reason, so it is added to the payload here.
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (needsPhoto && !file) {
      setPhotoError(PHOTO_REQUIRED_MESSAGE)
      setPhotoFocusKey((k) => k + 1)
      return
    }
    if (photoError) {
      setPhotoFocusKey((k) => k + 1)
      return
    }
    const formData = new FormData(e.currentTarget)
    if (file) formData.set('receipt_file', file)
    startTransition(() => formAction(formData))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* The idempotency key guards a create against a double submit. An edit
          is naturally idempotent — the same values written twice produce the
          same row — so it carries the receipt id instead. */}
      {isEdit ? (
        <input type="hidden" name="receipt_id" value={receipt.id} />
      ) : (
        <input type="hidden" name="client_idempotency_key" value={idempotencyKey} />
      )}

      {state && 'error' in state && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3"
        >
          <AlertCircle className="size-4 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="font-body text-sm text-red-700">{state.error}</p>
        </div>
      )}

      <ReceiptPhotoField
        file={file}
        onChange={choosePhoto}
        hasStoredPhoto={Boolean(receipt?.hasFile)}
        error={photoError ?? serverPhotoError}
        focusKey={photoFocusKey}
      />

      <Field
        id="raw_business_name"
        label="Business *"
        hint="Start typing and we'll match it to a business on The BLACQList. Not there yet? Type the name anyway."
        error={fieldErrors.raw_business_name}
      >
        <ListingCombobox
          id="raw_business_name"
          defaultName={receipt?.rawBusinessName ?? ''}
          defaultSelected={isEdit ? receipt.listing : prefillListing}
          invalid={Boolean(fieldErrors.raw_business_name)}
          className={inputCls}
        />
      </Field>

      <Field
        id="amount_dollars"
        label="Amount *"
        hint="The total on the receipt, in dollars. Up to $10,000."
        error={fieldErrors.amount_dollars}
      >
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-charcoal-soft pointer-events-none">
            $
          </span>
          <input
            id="amount_dollars"
            name="amount_dollars"
            type="number"
            inputMode="decimal"
            min="0.01"
            max={MAX_RECEIPT_AMOUNT_CENTS / 100}
            step="0.01"
            required
            placeholder="0.00"
            defaultValue={receipt ? (receipt.amountCents / 100).toFixed(2) : undefined}
            className={`${inputCls} pl-7`}
          />
        </div>
      </Field>

      <Field
        id="purchase_date"
        label="Date *"
        hint={`From the last ${MAX_RECEIPT_AGE_DAYS} days.`}
        error={fieldErrors.purchase_date}
      >
        <input
          key={onDevice ? 'device' : 'server'}
          id="purchase_date"
          name="purchase_date"
          type="date"
          required
          min={dateBounds.min}
          max={dateBounds.max}
          defaultValue={receipt?.purchaseDate ?? dateBounds.max}
          className={inputCls}
        />
      </Field>

      {/* Optional extras stay out of the fast path. Opened by default when one
          already holds a value, so an edit never hides what was saved. */}
      <details
        className="group rounded-lg border border-charcoal/10"
        open={Boolean(receipt?.notes || receipt?.aggregateOptOut)}
      >
        <summary className="flex items-center justify-between min-h-11 px-4 cursor-pointer list-none font-subhead text-sm font-semibold text-brand-black [&::-webkit-details-marker]:hidden">
          More options
          <ChevronDown
            className="size-4 text-charcoal-faint transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </summary>
        <div className="space-y-5 px-4 pb-4">
          <Field id="notes" label="Notes" hint="Optional. Anything else about this purchase.">
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={500}
              placeholder="Optional notes…"
              defaultValue={receipt?.notes ?? undefined}
              className={textareaCls}
            />
          </Field>

          {/* Privacy notice + opt-out */}
          <div className="rounded-lg bg-pale-lavender/60 border border-charcoal/10 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Info className="size-4 text-charcoal-faint shrink-0 mt-0.5" aria-hidden="true" />
              <p className="font-body text-xs text-charcoal-soft leading-relaxed">
                Receipt details are private. Only you and BLACQList admins can see your receipt.
                We use anonymized totals to power the community spend map. Your name is never
                attached to public data.
              </p>
            </div>
            <label className="flex items-start gap-3 min-h-11 cursor-pointer">
              <input
                type="checkbox"
                name="aggregate_opt_out"
                defaultChecked={receipt?.aggregateOptOut}
                className="mt-0.5 size-4 rounded border-charcoal/30 accent-amber-gold"
              />
              <span className="font-body text-xs text-charcoal-soft leading-relaxed">
                Exclude my spend from community totals and the public flow map.
              </span>
            </label>
          </div>
        </div>
      </details>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto h-12 px-6 rounded-full bg-amber-gold hover:bg-light-gold disabled:opacity-60 disabled:cursor-not-allowed text-brand-black font-subhead font-bold text-sm transition-colors"
        >
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isEdit
            ? isPending
              ? 'Saving…'
              : receipt.needsFix
                ? 'Resend for review'
                : 'Save changes'
            : isPending
              ? 'Adding…'
              : 'Add a receipt'}
        </button>
      </div>
    </form>
  )
}
