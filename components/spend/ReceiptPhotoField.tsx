'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, FileText, Upload } from 'lucide-react'

import { MAX_RECEIPT_BYTES, RECEIPT_MIME_TYPES } from '@/lib/spend/receipt-input'

/**
 * The receipt photo, first on the form (ticket 162).
 *
 * Two inputs, neither named: the form adds the chosen file itself, so the file
 * survives a server refusal instead of being cleared with the input. The
 * camera input carries `capture="environment"` and only shows on touch
 * screens, where it opens the rear camera directly; the picker covers
 * desktops and anyone whose photo is already in their library.
 */

/** HEIC previews don't render outside Safari, and a PDF isn't an image. */
const PREVIEWABLE = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** The limit a chosen file breaks, in words, or null when it is fine. */
export function receiptFileProblem(file: File): string | null {
  if (!RECEIPT_MIME_TYPES[file.type]) return 'Use a JPEG, PNG, WebP or HEIC photo, or a PDF.'
  if (file.size > MAX_RECEIPT_BYTES) return 'File must be under 10 MB.'
  return null
}

interface Props {
  file: File | null
  onChange: (file: File | null) => void
  /** Edit mode with a stored photo: leaving this empty keeps it. */
  hasStoredPhoto: boolean
  error?: string
  /** Bumped by the form when the photo is missing, to move focus here. */
  focusKey: number
}

export function ReceiptPhotoField({ file, onChange, hasStoredPhoto, error, focusKey }: Props) {
  const groupRef = useRef<HTMLDivElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const pickerRef = useRef<HTMLInputElement>(null)
  const [lastSource, setLastSource] = useState<'camera' | 'picker'>('picker')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Focus the first button the reader can actually see: the camera button is
  // hidden on mouse-driven screens.
  useEffect(() => {
    if (focusKey === 0) return
    const buttons = groupRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? []
    Array.from(buttons)
      .find((b) => b.offsetParent !== null)
      ?.focus()
  }, [focusKey])

  // The preview URL is made and released in the handlers, not an effect, so
  // there is exactly one live URL at a time.
  function setPreview(next: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(next && PREVIEWABLE.has(next.type) ? URL.createObjectURL(next) : null)
  }

  function choose(source: 'camera' | 'picker', e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0] ?? null
    // Cleared so picking the same file again still fires a change.
    e.target.value = ''
    if (!chosen) return
    setLastSource(source)
    setPreview(chosen)
    onChange(chosen)
  }

  function remove() {
    setPreview(null)
    onChange(null)
  }

  const errorId = 'receipt_file-error'
  const btnBase =
    'inline-flex items-center justify-center gap-2 h-11 px-4 rounded-full font-subhead text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60'

  return (
    <div ref={groupRef} className="space-y-2" role="group" aria-labelledby="receipt_file-label">
      <p id="receipt_file-label" className="font-subhead text-sm font-semibold text-brand-black">
        Receipt photo *
      </p>
      <p className="font-body text-xs text-charcoal-soft">
        {hasStoredPhoto
          ? 'Your photo is attached. Choose a new one only if you want to replace it.'
          : 'Take a clear photo of the whole receipt. JPEG, PNG, WebP, HEIC or PDF, up to 10 MB.'}
      </p>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => choose('camera', e)}
      />
      <input
        ref={pickerRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => choose('picker', e)}
      />

      {file ? (
        <div className="rounded-lg border border-charcoal/15 bg-white p-3 space-y-3">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Your receipt photo"
              className="w-full max-h-72 object-contain rounded-md bg-[#f9f9fb]"
            />
          ) : (
            <div className="flex items-center gap-2 rounded-md bg-[#f9f9fb] px-3 py-4">
              <FileText className="size-5 text-charcoal-faint shrink-0" aria-hidden="true" />
              <span className="font-body text-sm text-charcoal-soft truncate">{file.name}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => (lastSource === 'camera' ? cameraRef : pickerRef).current?.click()}
              className={`${btnBase} border border-charcoal/20 bg-white text-brand-black hover:bg-charcoal/5`}
            >
              Retake
            </button>
            <button
              type="button"
              onClick={remove}
              className={`${btnBase} text-charcoal-soft underline underline-offset-2 hover:text-brand-black`}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Shown on touch screens only, where the camera is the fast path. */}
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            aria-describedby={error ? errorId : undefined}
            className={`${btnBase} hidden pointer-coarse:inline-flex w-full sm:w-auto bg-amber-gold hover:bg-light-gold text-brand-black`}
          >
            <Camera className="size-4" aria-hidden="true" />
            {hasStoredPhoto ? 'Take a new photo' : 'Take a photo'}
          </button>
          <button
            type="button"
            onClick={() => pickerRef.current?.click()}
            aria-describedby={error ? errorId : undefined}
            className={`${btnBase} w-full sm:w-auto border border-dashed border-charcoal/30 bg-white text-charcoal-soft hover:border-amber-gold/60 hover:bg-amber-gold/5`}
          >
            <Upload className="size-4" aria-hidden="true" />
            {hasStoredPhoto ? 'Choose a new file' : 'Choose a file'}
          </button>
        </div>
      )}

      {error && (
        <p id={errorId} role="alert" className="font-body text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
