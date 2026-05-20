'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, Upload, Info } from 'lucide-react'

import { createReceiptSubmissionAction } from '@/lib/actions/spend/createReceiptSubmission'
import type { ReceiptSubmissionState } from '@/lib/actions/spend/createReceiptSubmission'

const inputCls =
  'w-full h-11 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/60'
const textareaCls =
  'w-full px-3 py-2.5 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/60 resize-y'

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
      {hint && <p className="font-body text-xs text-charcoal/50">{hint}</p>}
      {children}
      {error && (
        <p role="alert" className="font-body text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}

function formatDollars(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export function ReceiptSubmissionForm() {
  const [state, formAction, isPending] = useActionState<ReceiptSubmissionState, FormData>(
    createReceiptSubmissionAction,
    null
  )
  const router = useRouter()
  const [idempotencyKey] = useState(() => crypto.randomUUID())
  const [fileName, setFileName] = useState<string | null>(null)

  useEffect(() => {
    if (state && 'success' in state) {
      router.push('/account/receipts?submitted=true')
    }
  }, [state, router])

  const fieldErrors = state && 'fieldErrors' in state && state.fieldErrors ? state.fieldErrors : {}

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-6">
      <input type="hidden" name="client_idempotency_key" value={idempotencyKey} />

      {state && 'error' in state && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3"
        >
          <AlertCircle className="size-4 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="font-body text-sm text-red-700">{state.error}</p>
        </div>
      )}

      <Field
        id="raw_business_name"
        label="Business name"
        hint="Enter the name of the Black-owned business you spent money at."
        error={fieldErrors.raw_business_name}
      >
        <input
          id="raw_business_name"
          name="raw_business_name"
          type="text"
          maxLength={200}
          placeholder="e.g. The Brown Sugar Bakery"
          className={inputCls}
        />
      </Field>

      <Field
        id="amount_dollars"
        label="Amount spent *"
        hint="Enter the total you spent, in dollars."
        error={fieldErrors.amount_dollars}
      >
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-body text-sm text-charcoal/50 pointer-events-none">
            $
          </span>
          <input
            id="amount_dollars"
            name="amount_dollars"
            type="number"
            min="0.01"
            step="0.01"
            required
            placeholder="0.00"
            className={`${inputCls} pl-7`}
          />
        </div>
      </Field>

      <Field id="purchase_date" label="Purchase date *" error={fieldErrors.purchase_date}>
        <input
          id="purchase_date"
          name="purchase_date"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className={inputCls}
        />
      </Field>

      <Field
        id="notes"
        label="Notes"
        hint="Optional — anything else you want to add about this purchase."
      >
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={500}
          placeholder="Optional notes…"
          className={textareaCls}
        />
      </Field>

      {/* Optional receipt image */}
      <div className="space-y-1">
        <label
          htmlFor="receipt_file"
          className="block font-subhead text-sm font-semibold text-brand-black"
        >
          Receipt photo
        </label>
        <p className="font-body text-xs text-charcoal/50">
          Optional — attach a photo of your receipt. JPEG, PNG, HEIC, up to 10 MB.
        </p>
        <label
          htmlFor="receipt_file"
          className="flex items-center gap-3 h-11 px-3 rounded-lg border border-dashed border-charcoal/30 bg-white cursor-pointer hover:border-amber-gold/60 hover:bg-amber-gold/5 transition-colors"
        >
          <Upload className="size-4 text-charcoal/40 shrink-0" aria-hidden="true" />
          <span className="font-body text-sm text-charcoal/50 truncate">
            {fileName ?? 'Choose a photo…'}
          </span>
          <input
            id="receipt_file"
            name="receipt_file"
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
        {fieldErrors.receipt_file && (
          <p role="alert" className="font-body text-xs text-red-600">
            {fieldErrors.receipt_file}
          </p>
        )}
      </div>

      {/* Privacy notice + opt-out */}
      <div className="rounded-lg bg-pale-lavender/60 border border-charcoal/10 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Info className="size-4 text-charcoal/40 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="font-body text-xs text-charcoal/60 leading-relaxed">
            Receipt details are private — only you and BLACQList admins can see your submission. We
            use anonymized totals to power the community spend map. Your name is never attached to
            public data.
          </p>
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="aggregate_opt_out"
            className="mt-0.5 rounded border-charcoal/30 accent-amber-gold"
          />
          <span className="font-body text-xs text-charcoal/70 leading-relaxed">
            Exclude my spend from community totals and the public flow map.
          </span>
        </label>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 h-10 px-6 rounded-full bg-amber-gold hover:bg-light-gold disabled:opacity-60 disabled:cursor-not-allowed text-brand-black font-subhead font-bold text-sm transition-colors"
        >
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isPending ? 'Submitting…' : 'Submit receipt'}
        </button>
      </div>
    </form>
  )
}

// ─── Receipt list row ─────────────────────────────────────────────────────────

interface ReceiptRowProps {
  id: string
  rawBusinessName: string | null
  listingName: string | null
  amountCents: number
  purchaseDate: string
  status: string
  hasFile: boolean
}

export function ReceiptListRow({
  rawBusinessName,
  listingName,
  amountCents,
  purchaseDate,
  status,
}: ReceiptRowProps) {
  const businessLabel = listingName ?? rawBusinessName ?? 'Unknown business'

  return (
    <div className="py-4 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="font-subhead text-sm font-semibold text-brand-black truncate">
          {businessLabel}
        </p>
        <p className="font-body text-xs text-charcoal/50 mt-0.5">{purchaseDate}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-subhead text-sm font-semibold text-brand-black tabular-nums">
          {formatDollars(amountCents)}
        </span>
        <StatusPill status={status} />
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending_review: { label: 'Pending', cls: 'bg-amber-50 text-amber-700' },
    approved: { label: 'Approved', cls: 'bg-green-50 text-green-700' },
    rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700' },
  }
  const cfg = map[status] ?? { label: status, cls: 'bg-charcoal/5 text-charcoal/60' }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full font-subhead text-xs font-semibold ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  )
}
