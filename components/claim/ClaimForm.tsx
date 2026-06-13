'use client'

import { useActionState, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, AlertCircle, Loader2, Upload, FileText } from 'lucide-react'
import { createClaimAction } from '@/lib/actions/claims/createClaim'

interface Props {
  listingId: string
  listingName: string
}

const ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'authorized_agent', label: 'Authorized agent' },
] as const

type DocUploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export function ClaimForm({ listingId, listingName }: Props) {
  const [state, formAction, isPending] = useActionState(createClaimAction, null)
  const [notesLength, setNotesLength] = useState(0)
  const [tempEntityId] = useState(() => crypto.randomUUID())
  const [docPath, setDocPath] = useState<string | null>(null)
  const [docName, setDocName] = useState<string | null>(null)
  const [docSize, setDocSize] = useState<number | null>(null)
  const [docStatus, setDocStatus] = useState<DocUploadStatus>('idle')
  const [docError, setDocError] = useState<string | null>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  async function handleDocFile(file: File) {
    setDocStatus('uploading')
    setDocError(null)
    setDocName(file.name)
    setDocSize(file.size)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('bucket', 'verification-docs')
    fd.append('entity_id', tempEntityId)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = (await res.json()) as { data?: { path: string }; error?: string }
      if (!res.ok || !json.data?.path) {
        setDocStatus('error')
        setDocError(json.error ?? 'Upload failed. Please try again.')
        setDocPath(null)
      } else {
        setDocStatus('success')
        setDocPath(json.data.path)
      }
    } catch {
      setDocStatus('error')
      setDocError('Upload failed. Please check your connection and try again.')
      setDocPath(null)
    }
  }

  function removeDoc() {
    setDocPath(null)
    setDocName(null)
    setDocSize(null)
    setDocStatus('idle')
    setDocError(null)
  }

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (state && 'success' in state) {
    return (
      <div className="rounded-xl bg-white border border-charcoal/10 p-6 md:p-8">
        <div className="flex items-start gap-3 mb-4">
          <CheckCircle className="size-6 text-amber-gold flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="font-headline text-xl text-brand-black mb-1">Claim submitted!</h2>
            <p className="font-body text-sm text-charcoal leading-relaxed">
              We&apos;ll review your claim for <span className="font-semibold">{listingName}</span>{' '}
              and contact you within 3–5 business days.
            </p>
          </div>
        </div>
        <Link
          href="/account/claims"
          className="inline-flex items-center font-subhead text-sm font-semibold text-amber-gold hover:text-light-gold underline underline-offset-2"
        >
          View your claims in your account
        </Link>
      </div>
    )
  }

  const fieldErrors = state && 'fieldErrors' in state ? state.fieldErrors : undefined
  const topError = state && 'error' in state ? state.error : undefined

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="verification_doc_path" value={docPath ?? ''} />

      {topError && !fieldErrors && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3"
        >
          <AlertCircle className="size-4 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="font-body text-sm text-red-700">{topError}</p>
        </div>
      )}

      {fieldErrors && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3"
        >
          <AlertCircle className="size-4 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="font-body text-sm text-red-700">{topError}</p>
        </div>
      )}

      {/* Business email */}
      <div className="space-y-1.5">
        <label
          htmlFor="verification_email"
          className="block font-subhead text-sm font-semibold text-brand-black"
        >
          Business email address <span aria-hidden="true">*</span>
        </label>
        <p className="font-body text-xs text-charcoal/60">
          An email address associated with this business — used to verify your connection to it.
        </p>
        <input
          id="verification_email"
          type="email"
          name="verification_email"
          required
          autoComplete="email"
          inputMode="email"
          className="w-full h-11 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/60 aria-[invalid=true]:border-red-400"
          aria-invalid={fieldErrors?.verification_email ? true : undefined}
          aria-describedby={
            fieldErrors?.verification_email ? 'verification_email-error' : undefined
          }
        />
        {fieldErrors?.verification_email && (
          <p id="verification_email-error" role="alert" className="font-body text-xs text-red-600">
            {fieldErrors.verification_email}
          </p>
        )}
      </div>

      {/* Phone (optional) */}
      <div className="space-y-1.5">
        <label
          htmlFor="verification_phone"
          className="block font-subhead text-sm font-semibold text-brand-black"
        >
          Business phone number <span className="font-normal text-charcoal/60">(optional)</span>
        </label>
        <input
          id="verification_phone"
          type="tel"
          name="verification_phone"
          autoComplete="tel"
          inputMode="tel"
          className="w-full h-11 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/60"
        />
      </div>

      {/* Role */}
      <fieldset className="space-y-2">
        <legend className="font-subhead text-sm font-semibold text-brand-black">
          Your role at this business <span aria-hidden="true">*</span>
        </legend>
        {fieldErrors?.role_at_business && (
          <p role="alert" className="font-body text-xs text-red-600">
            {fieldErrors.role_at_business}
          </p>
        )}
        <div className="space-y-2">
          {ROLES.map(({ value, label }) => (
            <label
              key={value}
              className="flex items-center gap-3 cursor-pointer rounded-lg border border-charcoal/15 bg-white px-4 py-3 hover:border-amber-gold/50 has-[:checked]:border-amber-gold has-[:checked]:bg-amber-gold/5"
            >
              <input
                type="radio"
                name="role_at_business"
                value={value}
                className="accent-amber-gold"
              />
              <span className="font-body text-sm text-brand-black">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Notes (optional) */}
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="notes"
            className="block font-subhead text-sm font-semibold text-brand-black"
          >
            Additional notes <span className="font-normal text-charcoal/60">(optional)</span>
          </label>
          <span className="font-body text-xs text-charcoal/50" aria-live="polite">
            {notesLength}/500
          </span>
        </div>
        <p className="font-body text-xs text-charcoal/60">
          Any additional context that may help us verify your claim.
        </p>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={500}
          onChange={(e) => setNotesLength(e.target.value.length)}
          className="w-full px-3 py-2 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/60 resize-none aria-[invalid=true]:border-red-400"
          aria-invalid={fieldErrors?.notes ? true : undefined}
          aria-describedby={fieldErrors?.notes ? 'notes-error' : undefined}
        />
        {fieldErrors?.notes && (
          <p id="notes-error" role="alert" className="font-body text-xs text-red-600">
            {fieldErrors.notes}
          </p>
        )}
      </div>

      {/* Verification document (optional) */}
      <div className="space-y-1.5">
        <p className="font-subhead text-sm font-semibold text-brand-black">
          Verification document <span className="font-normal text-charcoal/60">(optional)</span>
        </p>
        <p className="font-body text-xs text-charcoal/60">
          A business card, invoice, utility bill, or any document showing your connection to this
          business. JPG, PNG, or PDF, up to 10 MB.
        </p>

        {docStatus === 'success' && docName ? (
          <div className="flex items-center gap-3 rounded-lg border border-charcoal/20 bg-charcoal/3 px-3 py-2.5">
            <FileText className="size-4 shrink-0 text-amber-gold" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-subhead text-xs font-semibold text-brand-black truncate">
                {docName}
              </p>
              {docSize !== null && (
                <p className="font-body text-[10px] text-charcoal/50">{formatBytes(docSize)}</p>
              )}
            </div>
            <button
              type="button"
              onClick={removeDoc}
              aria-label="Remove document"
              className="shrink-0 font-subhead text-xs text-charcoal/50 hover:text-red-600 underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => docInputRef.current?.click()}
            disabled={docStatus === 'uploading'}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-charcoal/25 bg-white font-subhead text-xs text-charcoal/50 hover:border-amber-gold hover:bg-amber-gold/5 hover:text-charcoal transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {docStatus === 'uploading' ? (
              <>
                <Loader2 className="size-4 animate-spin text-amber-gold" aria-hidden="true" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="size-4" aria-hidden="true" />
                {docStatus === 'error' ? 'Tap to retry' : 'Upload a document'}
              </>
            )}
          </button>
        )}

        {docError && (
          <p role="alert" className="font-body text-xs text-red-600">
            {docError}
          </p>
        )}

        <input
          ref={docInputRef}
          type="file"
          accept="image/jpeg,image/png,application/pdf"
          className="sr-only"
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleDocFile(file)
            e.target.value = ''
          }}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-full bg-amber-gold hover:bg-light-gold disabled:opacity-60 disabled:cursor-not-allowed text-brand-black font-subhead font-bold text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-gold"
      >
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isPending ? 'Submitting…' : 'Submit claim'}
      </button>

      <p className="font-body text-xs text-charcoal/50 text-center">
        By submitting, you confirm that you are authorized to claim this business.
      </p>
    </form>
  )
}
