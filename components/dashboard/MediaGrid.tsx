'use client'

import { useActionState, useState, useRef } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  Trash2,
  Upload,
  CheckCircle,
  AlertCircle,
  Pencil,
  X,
  ImagePlus,
  Star,
} from 'lucide-react'
import { deleteMediaAction } from '@/lib/actions/dashboard/deleteMedia'
import { updateMediaAltTextAction } from '@/lib/actions/dashboard/updateMediaAltText'
import { setCoverImageAction } from '@/lib/actions/dashboard/setCoverImage'

interface MediaItem {
  id: string
  file_path: string
  file_type: string
  alt_text: string | null
  display_order: number | null
}

interface Props {
  media: MediaItem[]
  supabaseStorageUrl: string
  listingId: string
  /** `listings.cover_image_path` — the file path of the photo currently used as the cover. */
  coverImagePath: string | null
}

function AltTextForm({ item }: { item: MediaItem }) {
  const [editing, setEditing] = useState(false)
  const [state, formAction, isPending] = useActionState(updateMediaAltTextAction, null)

  if (!editing) {
    return (
      <div className="flex items-center gap-1 min-w-0">
        <p className="font-body text-xs text-charcoal-soft truncate flex-1">
          {item.alt_text || <span className="italic">No alt text</span>}
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit alt text"
          className="shrink-0 text-charcoal-faint hover:text-charcoal-soft transition-colors"
        >
          <Pencil className="size-3" aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="media_id" value={item.id} />
      <div className="flex items-center gap-1">
        <input
          name="alt_text"
          type="text"
          defaultValue={item.alt_text ?? ''}
          maxLength={200}
          placeholder="Describe this image…"
          aria-label="Alt text"
          className="flex-1 min-w-0 px-2 py-1 rounded border border-charcoal/20 font-body text-xs text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-1 focus:ring-amber-gold/40"
        />
        <button
          type="submit"
          disabled={isPending}
          aria-label="Save alt text"
          className="shrink-0 inline-flex items-center justify-center size-6 rounded text-green-600 hover:bg-green-50 disabled:opacity-50 transition-colors"
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle className="size-3" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          aria-label="Cancel"
          className="shrink-0 inline-flex items-center justify-center size-6 rounded text-charcoal-faint hover:bg-charcoal/5 transition-colors"
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      </div>
      {state && 'error' in state && (
        <p role="alert" className="font-body text-xs text-red-600">
          {state.error}
        </p>
      )}
    </form>
  )
}

function MediaCard({
  item,
  supabaseStorageUrl,
  listingId,
  isCover,
}: {
  item: MediaItem
  supabaseStorageUrl: string
  listingId: string
  isCover: boolean
}) {
  const [deleteState, deleteAction, isDeleting] = useActionState(deleteMediaAction, null)
  const [coverState, coverAction, isSettingCover] = useActionState(setCoverImageAction, null)
  const imageUrl = `${supabaseStorageUrl}/listing-media/${item.file_path}`

  return (
    <li
      className={`rounded-lg border bg-white overflow-hidden ${
        isCover ? 'border-amber-gold ring-1 ring-amber-gold/40' : 'border-charcoal/10'
      }`}
    >
      <div className="relative aspect-square bg-charcoal/5">
        <Image
          src={imageUrl}
          alt={item.alt_text ?? 'Business photo'}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        {isCover && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-gold text-brand-black font-subhead text-[11px] font-bold">
            <Star className="size-3 fill-current" aria-hidden="true" /> Cover
          </span>
        )}
        <form action={deleteAction} className="absolute top-2 right-2">
          <input type="hidden" name="media_id" value={item.id} />
          <button
            type="submit"
            disabled={isDeleting}
            aria-label="Delete photo"
            onClick={(e) => {
              if (!window.confirm('Delete this photo? This cannot be undone.')) {
                e.preventDefault()
              }
            }}
            className="inline-flex items-center justify-center size-7 rounded-lg bg-brand-black/70 text-white hover:bg-red-600 disabled:opacity-50 transition-colors backdrop-blur-sm"
          >
            {isDeleting ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="size-3.5" aria-hidden="true" />
            )}
          </button>
        </form>
      </div>
      <div className="px-3 py-2 space-y-1.5">
        <AltTextForm item={item} />

        <form action={coverAction}>
          <input type="hidden" name="listing_id" value={listingId} />
          {!isCover && <input type="hidden" name="media_id" value={item.id} />}
          <button
            type="submit"
            disabled={isSettingCover}
            className={`w-full inline-flex items-center justify-center gap-1 h-7 rounded font-subhead text-xs font-semibold disabled:opacity-50 transition-colors ${
              isCover
                ? 'text-charcoal-soft hover:bg-charcoal/5'
                : 'text-brand-black bg-pale-lavender hover:bg-amber-gold'
            }`}
          >
            {isSettingCover ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : (
              <Star className="size-3" aria-hidden="true" />
            )}
            {isCover ? 'Remove as cover' : 'Set as cover'}
          </button>
        </form>

        {[deleteState, coverState].map(
          (s, i) =>
            s &&
            'error' in s && (
              <div key={i} role="alert" className="flex items-center gap-1">
                <AlertCircle className="size-3 text-red-500 shrink-0" aria-hidden="true" />
                <p className="font-body text-xs text-red-600">{s.error}</p>
              </div>
            )
        )}
      </div>
    </li>
  )
}

// Resize and re-encode to JPEG at max 1920px on the longest side (~<1 MB for most photos)
async function compressImage(file: File, maxPx = 1920, quality = 0.85): Promise<File> {
  return new Promise((resolve) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          resolve(new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }))
        },
        'image/jpeg',
        quality
      )
    }
    img.onerror = () => resolve(file)
    img.src = url
  })
}

function MediaUploadForm({ listingId }: { listingId: string }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [compressedFile, setCompressedFile] = useState<File | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) {
      setPreview(null)
      setCompressedFile(null)
      return
    }
    setError(null)
    setPreview(URL.createObjectURL(file))
    setIsCompressing(true)
    const compressed = await compressImage(file)
    setCompressedFile(compressed)
    setIsCompressing(false)
  }

  function handleClear() {
    setPreview(null)
    setCompressedFile(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!compressedFile || isCompressing || isUploading) return
    setError(null)
    setIsUploading(true)

    const fd = new FormData()
    fd.append('listing_id', listingId)
    fd.append('file', compressedFile, compressedFile.name)

    try {
      const res = await fetch('/api/media/upload', { method: 'POST', body: fd })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Upload failed. Please try again.')
      } else {
        setPreview(null)
        setCompressedFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
        router.refresh()
      }
    } catch {
      setError('Upload failed. Please check your connection and try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const isBusy = isCompressing || isUploading

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {preview ? (
        <div className="relative rounded-lg overflow-hidden border border-charcoal/15 bg-charcoal/5 aspect-video w-full max-w-xs mx-auto">
          <Image src={preview} alt="Upload preview" fill className="object-contain" />
          <button
            type="button"
            onClick={handleClear}
            aria-label="Remove selected photo"
            className="absolute top-2 right-2 size-7 flex items-center justify-center rounded-lg bg-brand-black/70 text-white hover:bg-red-600 transition-colors"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-lg border-2 border-dashed border-charcoal/20 px-4 py-8 text-center hover:border-amber-gold/40 hover:bg-amber-gold/5 transition-colors group"
        >
          <ImagePlus
            className="size-8 text-charcoal/25 group-hover:text-amber/50 mx-auto mb-2 transition-colors"
            aria-hidden="true"
          />
          <p className="font-subhead text-sm font-semibold text-charcoal-soft group-hover:text-charcoal-soft">
            Click to choose a photo
          </p>
          <p className="font-body text-xs text-charcoal/35 mt-0.5">
            JPEG, PNG, WebP or GIF · any size
          </p>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        capture="environment"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Choose photo to upload"
      />

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2"
        >
          <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
          <p className="font-body text-sm text-red-700">{error}</p>
        </div>
      )}

      {preview && (
        <button
          type="submit"
          disabled={isBusy}
          className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isCompressing ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Preparing…
            </>
          ) : isUploading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Uploading…
            </>
          ) : (
            <>
              <Upload className="size-4" aria-hidden="true" /> Upload photo
            </>
          )}
        </button>
      )}
    </form>
  )
}

export function MediaGrid({ media, supabaseStorageUrl, listingId, coverImagePath }: Props) {
  const hasCover = !!coverImagePath

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Photos</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          Add photos to showcase your business. Use descriptive alt text to improve accessibility
          and SEO. Upload at <strong className="font-semibold">1200×800px or larger</strong> for
          best quality.
        </p>
      </div>
      <div className="px-5 py-4 space-y-4">
        {!hasCover && (
          <div className="rounded-lg border border-amber-gold/40 bg-amber-gold/10 px-4 py-3">
            <p className="font-subhead text-sm font-bold text-brand-black">
              {media.length === 0
                ? 'Start with your cover photo'
                : 'Pick one photo as your cover'}
            </p>
            <p className="font-body text-xs text-charcoal-soft mt-0.5">
              {media.length === 0
                ? 'Upload a photo below, then choose “Set as cover.” Until you do, your business shows a brand tile in search results and collections instead of your own photo.'
                : 'Choose “Set as cover” on the photo that best represents your business. Until you do, it shows a brand tile in search results and collections.'}
            </p>
          </div>
        )}
        {media.length > 0 && (
          <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {media.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                supabaseStorageUrl={supabaseStorageUrl}
                listingId={listingId}
                isCover={item.file_path === coverImagePath}
              />
            ))}
          </ul>
        )}
        <MediaUploadForm listingId={listingId} />
      </div>
    </div>
  )
}
