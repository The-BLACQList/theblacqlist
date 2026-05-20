'use client'

import { useActionState, useRef, useState } from 'react'
import { FileText, ImageIcon, Loader2, X } from 'lucide-react'
import { submitVerificationRequest } from '@/lib/actions/owner/submitVerificationRequest'
import type { SubmitVerificationState } from '@/lib/actions/owner/submitVerificationRequest'

interface UploadedFile {
  name: string
  size: number
  path: string
  type: string
}

interface Props {
  listingId: string
  rejectionNotes?: string | null
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const ACCEPTED = 'image/jpeg,image/png,image/webp,application/pdf'
const MAX_FILES = 5
const MAX_BYTES = 10 * 1024 * 1024

export function VerificationUploadForm({ listingId, rejectionNotes }: Props) {
  const [state, formAction, isPending] = useActionState<SubmitVerificationState, FormData>(
    submitVerificationRequest,
    null
  )
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return
    if (files.length + selected.length > MAX_FILES) {
      setUploadError(`You can upload at most ${MAX_FILES} documents.`)
      return
    }

    setUploadError(null)
    setUploading(true)

    for (const file of selected) {
      if (file.size > MAX_BYTES) {
        setUploadError(`${file.name} exceeds the 10 MB limit.`)
        setUploading(false)
        return
      }

      const body = new FormData()
      body.append('file', file)

      const res = await fetch('/api/upload/receipt-uploads', { method: 'POST', body })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setUploadError((json as { error?: string }).error ?? 'Upload failed. Please try again.')
        setUploading(false)
        return
      }

      const { path } = (await res.json()) as { path: string }
      setFiles((prev) => [...prev, { name: file.name, size: file.size, path, type: file.type }])
    }

    setUploading(false)
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeFile(path: string) {
    setFiles((prev) => prev.filter((f) => f.path !== path))
  }

  if (state && 'success' in state && state.success) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4">
        <p className="font-subhead text-sm font-semibold text-green-800">
          Verification request submitted
        </p>
        <p className="font-body text-sm text-green-700 mt-1">
          Our team will review your documents within 2–3 business days. You&apos;ll receive an
          update in your dashboard.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {rejectionNotes && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="font-subhead text-xs font-semibold text-red-700 mb-1">
            Previous submission rejected
          </p>
          <p className="font-body text-sm text-red-700 whitespace-pre-wrap">{rejectionNotes}</p>
        </div>
      )}

      <div className="rounded-xl border border-charcoal/10 bg-[#f5f5f7] px-5 py-4 space-y-1">
        <p className="font-subhead text-sm font-semibold text-brand-black">
          Upload verification documents
        </p>
        <p className="font-body text-sm text-charcoal/70">
          Upload at least one: business license, utility bill, lease agreement, or government-issued
          ID showing your business name. Max 5 files, 10 MB each. JPEG, PNG, and PDF accepted.
        </p>
      </div>

      {/* File input */}
      <div>
        <label
          htmlFor="verification-file-input"
          className={`flex items-center justify-center gap-2 w-full h-14 rounded-xl border-2 border-dashed cursor-pointer transition-colors font-subhead text-sm font-semibold
            ${
              uploading || files.length >= MAX_FILES
                ? 'border-charcoal/15 text-charcoal/30 cursor-not-allowed'
                : 'border-charcoal/25 text-charcoal/60 hover:border-amber-gold hover:text-amber-gold'
            }`}
        >
          {uploading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Uploading…
            </>
          ) : files.length >= MAX_FILES ? (
            `Maximum ${MAX_FILES} files reached`
          ) : (
            'Choose file(s) to upload'
          )}
        </label>
        <input
          ref={inputRef}
          id="verification-file-input"
          type="file"
          accept={ACCEPTED}
          multiple
          disabled={uploading || files.length >= MAX_FILES}
          onChange={handleFileChange}
          className="sr-only"
        />
      </div>

      {uploadError && (
        <p className="font-body text-sm text-red-600" role="alert">
          {uploadError}
        </p>
      )}

      {/* Uploaded file list */}
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.path}
              className="flex items-center gap-3 rounded-lg border border-charcoal/10 bg-white px-4 py-2.5"
            >
              {f.type === 'application/pdf' ? (
                <FileText className="size-4 shrink-0 text-charcoal/50" aria-hidden="true" />
              ) : (
                <ImageIcon className="size-4 shrink-0 text-charcoal/50" aria-hidden="true" />
              )}
              <span className="flex-1 min-w-0 font-body text-sm text-brand-black truncate">
                {f.name}
              </span>
              <span className="font-body text-xs text-charcoal/50 shrink-0">
                {formatBytes(f.size)}
              </span>
              <button
                type="button"
                onClick={() => removeFile(f.path)}
                aria-label={`Remove ${f.name}`}
                className="shrink-0 p-1 rounded hover:bg-charcoal/8 text-charcoal/40 hover:text-charcoal"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Submit */}
      <form action={formAction}>
        <input type="hidden" name="listing_id" value={listingId} />
        {files.map((f) => (
          <input key={f.path} type="hidden" name="doc_paths[]" value={f.path} />
        ))}

        {state && 'error' in state && (
          <p className="font-body text-sm text-red-600 mb-3" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending || uploading || files.length === 0}
          className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-amber-gold hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed text-brand-black font-subhead font-bold text-sm transition-colors"
        >
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Submit for verification
        </button>
      </form>
    </div>
  )
}
