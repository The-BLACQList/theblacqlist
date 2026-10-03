'use client'

import { useRef, useState, useEffect } from 'react'
import { Upload, X, Loader2, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { photoLimit } from '@/lib/stripe/features'
import { discardDraftPhotoAction } from '@/lib/actions/listings/discardDraftPhoto'

// A new listing always starts on Free, so add-business offers the Free gallery
// limit. The upload route enforces the same number (ticket 119).
const GALLERY_LIMIT = photoLimit('free') ?? 1

interface UploadState {
  status: 'idle' | 'uploading' | 'success' | 'error'
  path: string | null
  cdnUrl: string | null
  errorMsg: string | null
}

const IDLE: UploadState = { status: 'idle', path: null, cdnUrl: null, errorMsg: null }

interface GalleryItem extends UploadState {
  localId: string
  mediaId?: string
}

interface Props {
  tempEntityId: string
  logoCdnUrl: string | null
  coverCdnUrl: string | null
  galleryPaths: string[]
  onLogoChange: (path: string | null, cdnUrl: string | null) => void
  onCoverChange: (path: string | null, cdnUrl: string | null) => void
  onGalleryChange: (paths: string[]) => void
}

function getPublicUrl(path: string): string {
  const supabase = createClient()
  return supabase.storage.from('listing-media').getPublicUrl(path).data.publicUrl
}

async function uploadFile(
  file: File,
  tempEntityId: string,
  mediaRole: 'logo' | 'cover' | 'gallery'
): Promise<{ path: string; mediaId?: string } | { error: string }> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('bucket', 'listing-media')
  fd.append('entity_id', tempEntityId)
  fd.append('media_role', mediaRole)

  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  const json = (await res.json()) as { data?: { path: string; mediaId?: string }; error?: string }

  if (!res.ok || !json.data?.path) {
    return { error: json.error ?? 'Upload failed. Please try again.' }
  }
  return { path: json.data.path, mediaId: json.data.mediaId }
}

function UploadZone({
  label,
  hint,
  accept,
  state,
  onFile,
  onRemove,
}: {
  label: string
  hint: string
  accept: string
  state: UploadState
  onFile: (file: File) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-2">
      <p className="font-subhead text-sm font-semibold text-brand-black">{label}</p>
      <p className="font-subhead text-xs text-charcoal-soft -mt-1">{hint}</p>

      {state.status === 'success' && state.cdnUrl ? (
        <div className="relative w-full h-40 rounded-xl overflow-hidden border border-charcoal/20 bg-charcoal/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={state.cdnUrl} alt={label} className="absolute inset-0 h-full w-full object-cover" />
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${label}`}
            className="group absolute top-0 right-0 flex size-11 items-center justify-center"
          >
            {/* 44px hit area, modest 28px visual */}
            <span className="flex size-7 items-center justify-center rounded-full bg-brand-black/70 text-white transition-colors group-hover:bg-brand-black">
              <X className="size-3.5" aria-hidden="true" />
            </span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={state.status === 'uploading'}
          aria-describedby={state.errorMsg ? `${label}-error` : undefined}
          className={cn(
            'flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors',
            state.status === 'error'
              ? 'border-red-400 bg-red-50'
              : 'border-charcoal/25 bg-charcoal/3 hover:border-amber-gold hover:bg-amber-gold/5',
            state.status === 'uploading' && 'opacity-60 cursor-not-allowed'
          )}
        >
          {state.status === 'uploading' ? (
            <Loader2 className="size-6 animate-spin text-amber" aria-hidden="true" />
          ) : (
            <Upload
              className={cn(
                'size-6',
                state.status === 'error' ? 'text-red-400' : 'text-charcoal-faint'
              )}
              aria-hidden="true"
            />
          )}
          <span
            className={cn(
              'font-subhead text-xs',
              state.status === 'error' ? 'text-red-600' : 'text-charcoal-soft'
            )}
          >
            {state.status === 'uploading'
              ? 'Uploading…'
              : state.status === 'error'
                ? 'Tap to retry'
                : 'Tap to upload'}
          </span>
          {state.errorMsg && (
            <p id={`${label}-error`} role="alert" className="text-xs text-red-600 font-subhead">
              {state.errorMsg}
            </p>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

export function MediaStep({
  tempEntityId,
  onLogoChange,
  onCoverChange,
  onGalleryChange,
}: Props) {
  const [logoState, setLogoState] = useState<UploadState>(IDLE)
  const [coverState, setCoverState] = useState<UploadState>(IDLE)
  const [gallery, setGallery] = useState<GalleryItem[]>([])
  const galleryInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const successPaths = gallery
      .filter((g) => g.status === 'success' && g.path)
      .map((g) => g.path!)
    onGalleryChange(successPaths)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gallery])

  async function handleLogoFile(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setLogoState({ status: 'error', path: null, cdnUrl: null, errorMsg: 'Logo must be 2 MB or smaller.' })
      onLogoChange(null, null)
      return
    }
    setLogoState({ status: 'uploading', path: null, cdnUrl: null, errorMsg: null })
    const result = await uploadFile(file, tempEntityId, 'logo')
    if ('error' in result) {
      setLogoState({ status: 'error', path: null, cdnUrl: null, errorMsg: result.error })
      onLogoChange(null, null)
    } else {
      const cdnUrl = getPublicUrl(result.path)
      setLogoState({ status: 'success', path: result.path, cdnUrl, errorMsg: null })
      onLogoChange(result.path, cdnUrl)
    }
  }

  async function handleCoverFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setCoverState({ status: 'error', path: null, cdnUrl: null, errorMsg: 'Cover photo must be 5 MB or smaller.' })
      onCoverChange(null, null)
      return
    }
    setCoverState({ status: 'uploading', path: null, cdnUrl: null, errorMsg: null })
    const result = await uploadFile(file, tempEntityId, 'cover')
    if ('error' in result) {
      setCoverState({ status: 'error', path: null, cdnUrl: null, errorMsg: result.error })
      onCoverChange(null, null)
    } else {
      const cdnUrl = getPublicUrl(result.path)
      setCoverState({ status: 'success', path: result.path, cdnUrl, errorMsg: null })
      onCoverChange(result.path, cdnUrl)
    }
  }

  async function handleGalleryFiles(files: FileList) {
    const remaining = GALLERY_LIMIT - gallery.filter((g) => g.status === 'success').length
    const allFiles = Array.from(files).slice(0, remaining)
    const validFiles = allFiles.filter((f) => f.size <= 3 * 1024 * 1024)
    const oversizedFiles = allFiles.filter((f) => f.size > 3 * 1024 * 1024)

    const errorStubs: GalleryItem[] = oversizedFiles.map(() => ({
      localId: crypto.randomUUID(),
      status: 'error',
      path: null,
      cdnUrl: null,
      errorMsg: 'File must be 3 MB or smaller.',
    }))

    const stubs: GalleryItem[] = validFiles.map(() => ({
      localId: crypto.randomUUID(),
      status: 'uploading',
      path: null,
      cdnUrl: null,
      errorMsg: null,
    }))

    setGallery((prev) => [...prev, ...errorStubs, ...stubs])

    await Promise.all(
      stubs.map(async (stub, i) => {
        const file = validFiles[i]!
        const result = await uploadFile(file, tempEntityId, 'gallery')
        setGallery((prev) =>
          prev.map((g) => {
            if (g.localId !== stub.localId) return g
            if ('error' in result) {
              return { ...g, status: 'error' as const, errorMsg: result.error }
            }
            return {
              ...g,
              status: 'success' as const,
              path: result.path,
              mediaId: result.mediaId,
              cdnUrl: getPublicUrl(result.path),
            }
          })
        )
      })
    )
  }

  function removeGalleryItem(localId: string) {
    const item = gallery.find((g) => g.localId === localId)
    setGallery((prev) => prev.filter((g) => g.localId !== localId))
    // The upload already saved a record. Drop it too, or the photo still lands
    // on the page and keeps counting against the photo limit.
    if (item?.mediaId) void discardDraftPhotoAction(item.mediaId)
  }

  const successCount = gallery.filter((g) => g.status === 'success').length
  const canAddMore = successCount < GALLERY_LIMIT

  return (
    <div className="bg-white rounded-2xl border border-charcoal/10 p-6 flex flex-col gap-6">
      <div>
        <p className="font-subhead text-sm text-charcoal-soft leading-relaxed">
          Add photos to help people recognize your business. All photos are optional. You can add
          or update them later.
        </p>
      </div>

      <UploadZone
        label="Logo"
        hint="Square image, at most 2 MB. PNG or JPG recommended."
        accept="image/jpeg,image/png,image/webp"
        state={logoState}
        onFile={handleLogoFile}
        onRemove={() => {
          setLogoState(IDLE)
          onLogoChange(null, null)
        }}
      />

      <UploadZone
        label="Cover photo"
        hint="Wide banner image, at most 5 MB. Used as the page header."
        accept="image/jpeg,image/png,image/webp"
        state={coverState}
        onFile={handleCoverFile}
        onRemove={() => {
          setCoverState(IDLE)
          onCoverChange(null, null)
        }}
      />

      {/* Gallery */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="font-subhead text-sm font-semibold text-brand-black">Gallery photos</p>
          <span className="font-subhead text-xs text-charcoal-faint">{successCount}/{GALLERY_LIMIT}</span>
        </div>
        <p className="font-subhead text-xs text-charcoal-soft -mt-1">
          {GALLERY_LIMIT === 1 ? '1 photo' : `Up to ${GALLERY_LIMIT} photos`} on the free plan, 3 MB each. JPG, PNG, or WebP. Starter lets you add up to {photoLimit('starter')}.
        </p>

        {gallery.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {gallery.map((item) => (
              <div
                key={item.localId}
                className="relative aspect-square rounded-lg overflow-hidden border border-charcoal/20 bg-charcoal/5"
              >
                {item.status === 'uploading' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="size-5 animate-spin text-amber" />
                  </div>
                )}
                {item.status === 'success' && item.cdnUrl && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.cdnUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeGalleryItem(item.localId)}
                      aria-label="Remove photo"
                      className="group absolute top-0 right-0 flex size-11 items-center justify-center"
                    >
                      <span className="flex size-6 items-center justify-center rounded-full bg-brand-black/70 text-white transition-colors group-hover:bg-brand-black">
                        <X className="size-3" aria-hidden="true" />
                      </span>
                    </button>
                  </>
                )}
                {item.status === 'error' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2">
                    <ImageIcon className="size-4 text-red-400" />
                    <span className="font-subhead text-xs text-red-500 text-center leading-tight">
                      Failed
                    </span>
                    <button
                      type="button"
                      onClick={() => removeGalleryItem(item.localId)}
                      className="min-h-11 px-3 font-subhead text-xs text-charcoal-soft underline"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {canAddMore && (
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-charcoal/25 bg-charcoal/3 font-subhead text-xs text-charcoal-soft hover:border-amber-gold hover:bg-amber-gold/5 hover:text-charcoal transition-colors"
          >
            <Upload className="size-4" aria-hidden="true" />
            {GALLERY_LIMIT === 1 ? 'Add a photo' : `Add photos · ${GALLERY_LIMIT - successCount} left`}
          </button>
        )}

        <input
          ref={galleryInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple={GALLERY_LIMIT > 1}
          className="sr-only"
          aria-hidden="true"
          onChange={(e) => {
            if (e.target.files?.length) handleGalleryFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
