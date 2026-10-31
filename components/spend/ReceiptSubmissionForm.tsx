'use client'

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, Info, ChevronDown } from 'lucide-react'

import { createReceiptSubmissionAction } from '@/lib/actions/spend/createReceiptSubmission'
import type { ReceiptSubmissionState } from '@/lib/actions/spend/createReceiptSubmission'
import { updateReceiptSubmissionAction } from '@/lib/actions/spend/updateReceiptSubmission'
import { readReceiptPhoto, type ReceiptReadResult } from '@/lib/actions/spend/readReceiptPhoto'
import {
  MAX_RECEIPT_AGE_DAYS,
  MAX_RECEIPT_AMOUNT_CENTS,
  PHOTO_REQUIRED_MESSAGE,
  localIsoDay,
  receiptDateBounds,
} from '@/lib/spend/receipt-input'
import { FROM_PHOTO_LABEL, isReadablePhoto, type MatchedListing } from '@/lib/spend/receipt-read'
import { ListingCombobox } from './ListingCombobox'
import { ReceiptPhotoField, receiptFileProblem } from './ReceiptPhotoField'
import { ReceiptReadOptIn } from './ReceiptReadOptIn'
import { UnlistedInvite } from './UnlistedInvite'

const inputCls =
  'w-full h-11 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/60'
const textareaCls =
  'w-full px-3 py-2.5 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/60 resize-y'

function Field({
  id,
  label,
  hint,
  fromPhoto,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  /** Filled by the receipt read and not changed since (ticket 163). */
  fromPhoto?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block font-subhead text-sm font-semibold text-brand-black">
        {label}
      </label>
      {fromPhoto && (
        <p className="font-body text-xs font-semibold text-amber">{FROM_PHOTO_LABEL}</p>
      )}
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

type ReadField = 'business' | 'amount' | 'date'
const NO_FIELDS: Record<ReadField, boolean> = { business: false, amount: false, date: false }

export function ReceiptSubmissionForm({
  receipt,
  prefillListing = null,
  canReadReceipt = false,
}: {
  receipt?: ReceiptFormDefaults
  /** From `?listing=` on the new page ("I shopped here"). Ignored in edit mode. */
  prefillListing?: ReceiptFormDefaults['listing']
  /** FEATURE_RECEIPT_READ is on and the AI kill switch is off (ticket 163). New receipts only. */
  canReadReceipt?: boolean
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

  // ─── Read my receipt for me (ticket 163) ──────────────────────────────────
  // A read only fills fields the shopper hasn't touched, and each filled field
  // is remounted (by key) with the read value as its default, so it stays an
  // ordinary editable input. A read that fails, or finishes after the photo
  // changed, leaves the form exactly as it was, without a message.
  const readEnabled = canReadReceipt && !isEdit
  const [readOptIn, setReadOptIn] = useState(false)
  const [reading, setReading] = useState(false)
  const [readStatus, setReadStatus] = useState('')
  const [matches, setMatches] = useState<MatchedListing[]>([])
  const [fromPhoto, setFromPhoto] = useState(NO_FIELDS)
  const [business, setBusiness] = useState<{ name: string; selected: MatchedListing | null } | null>(
    null
  )
  const [amountFill, setAmountFill] = useState<string | null>(null)
  const [dateFill, setDateFill] = useState<string | null>(null)
  const [fillKeys, setFillKeys] = useState({ business: 0, amount: 0, date: 0 })
  // The name the business search found nothing for (ticket 168), tied to the
  // combobox instance it came from so a photo fill that remounts it drops it.
  const [noMatch, setNoMatch] = useState<{ name: string; key: number } | null>(null)
  const onNoMatch = useCallback(
    (name: string | null) => setNoMatch(name ? { name, key: fillKeys.business } : null),
    [fillKeys.business]
  )
  const touched = useRef({ ...NO_FIELDS })
  const readSeq = useRef(0)
  const lastRead = useRef<File | null>(null)

  function markTouched(field: ReadField) {
    touched.current[field] = true
    setFromPhoto((f) => (f[field] ? { ...f, [field]: false } : f))
    if (field === 'business') setMatches([])
  }

  function applyRead(result: Extract<ReceiptReadResult, { ok: true }>) {
    const filled: ReadField[] = []
    if (!touched.current.business && (result.strong || result.businessName)) {
      setBusiness({ name: result.strong?.name ?? result.businessName ?? '', selected: result.strong })
      setMatches(result.strong ? [] : result.matches)
      filled.push('business')
    }
    if (!touched.current.amount && result.amountCents !== null) {
      setAmountFill((result.amountCents / 100).toFixed(2))
      filled.push('amount')
    }
    // The server allows a day either side of UTC; hold it to this calendar.
    const d = result.purchaseDate
    if (!touched.current.date && d && d >= dateBounds.min && d <= dateBounds.max) {
      setDateFill(d)
      filled.push('date')
    }
    if (filled.length === 0) {
      setReadStatus('')
      return
    }
    setFillKeys((k) => {
      const next = { ...k }
      for (const f of filled) next[f] += 1
      return next
    })
    setFromPhoto((f) => {
      const next = { ...f }
      for (const field of filled) next[field] = true
      return next
    })
    setReadStatus('Filled from your photo. Check each field before you add the receipt.')
  }

  async function readPhoto(next: File | null) {
    const seq = ++readSeq.current
    setReading(false)
    if (!next || !isReadablePhoto(next) || receiptFileProblem(next) || lastRead.current === next) return
    lastRead.current = next
    setReading(true)
    setReadStatus('Reading your receipt…')
    const payload = new FormData()
    payload.set('receipt_file', next)
    let result: ReceiptReadResult = { ok: false }
    try {
      result = await readReceiptPhoto(payload)
    } catch {
      // Network or server trouble: the shopper fills the form in by hand.
    }
    if (seq !== readSeq.current) return
    setReading(false)
    if (result.ok) applyRead(result)
    else setReadStatus('')
  }

  function changeReadOptIn(checked: boolean) {
    setReadOptIn(checked)
    if (checked) void readPhoto(file)
    else {
      readSeq.current += 1
      setReading(false)
      setReadStatus('')
    }
  }

  function pickMatch(listing: MatchedListing) {
    setBusiness({ name: listing.name, selected: listing })
    setFillKeys((k) => ({ ...k, business: k.business + 1 }))
    setMatches([])
    setFromPhoto((f) => ({ ...f, business: false }))
    touched.current.business = true
  }

  function choosePhoto(next: File | null) {
    setFile(next)
    setPhotoError(next ? receiptFileProblem(next) : null)
    setPhotoErrorSeenFor(state)
    if (readEnabled && readOptIn) void readPhoto(next)
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

      {readEnabled && (
        <ReceiptReadOptIn
          checked={readOptIn}
          onCheckedChange={changeReadOptIn}
          reading={reading}
          status={readStatus}
          matches={matches}
          onPickMatch={pickMatch}
        />
      )}

      <Field
        id="raw_business_name"
        label="Business *"
        hint="Start typing and we'll match it to a business on The BLACQList. Not there yet? Type the name anyway."
        fromPhoto={fromPhoto.business}
        error={fieldErrors.raw_business_name}
      >
        {/* Typing, or clearing a chosen business, counts as editing it. */}
        <div
          onInput={() => markTouched('business')}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button')) markTouched('business')
          }}
        >
          <ListingCombobox
            key={`business-${fillKeys.business}`}
            id="raw_business_name"
            defaultName={business?.name ?? receipt?.rawBusinessName ?? ''}
            defaultSelected={
              business ? business.selected : isEdit ? receipt.listing : prefillListing
            }
            invalid={Boolean(fieldErrors.raw_business_name)}
            className={inputCls}
            onNoMatch={onNoMatch}
          />
        </div>
        {/* Outside the wrapper above, so tapping it doesn't count as editing the name. */}
        {noMatch && noMatch.key === fillKeys.business && (
          <UnlistedInvite businessName={noMatch.name} />
        )}
      </Field>

      <Field
        id="amount_dollars"
        label="Amount *"
        hint="The total on the receipt, in dollars. Up to $10,000."
        fromPhoto={fromPhoto.amount}
        error={fieldErrors.amount_dollars}
      >
        <div className="relative" onInput={() => markTouched('amount')}>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-charcoal-soft pointer-events-none">
            $
          </span>
          <input
            key={`amount-${fillKeys.amount}`}
            id="amount_dollars"
            name="amount_dollars"
            type="number"
            inputMode="decimal"
            min="0.01"
            max={MAX_RECEIPT_AMOUNT_CENTS / 100}
            step="0.01"
            required
            placeholder="0.00"
            defaultValue={
              amountFill ?? (receipt ? (receipt.amountCents / 100).toFixed(2) : undefined)
            }
            className={`${inputCls} pl-7`}
          />
        </div>
      </Field>

      <Field
        id="purchase_date"
        label="Date *"
        hint={`From the last ${MAX_RECEIPT_AGE_DAYS} days.`}
        fromPhoto={fromPhoto.date}
        error={fieldErrors.purchase_date}
      >
        <input
          key={`${onDevice ? 'device' : 'server'}-${fillKeys.date}`}
          onInput={() => markTouched('date')}
          id="purchase_date"
          name="purchase_date"
          type="date"
          required
          min={dateBounds.min}
          max={dateBounds.max}
          defaultValue={dateFill ?? receipt?.purchaseDate ?? dateBounds.max}
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
