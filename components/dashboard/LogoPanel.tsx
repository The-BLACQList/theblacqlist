'use client'

import { useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { setLogoAction } from '@/lib/actions/dashboard/setLogo'
import { LOGO_MAX_EDGE, LOGO_SIZE_TIP } from '@/lib/media/logo'

/** The upload route's logo limit (listingImageLimit('logo')). */
const LOGO_MAX_BYTES = 2 * 1024 * 1024

// Shrinks a large logo in the browser so it fits the 2 MB logo limit. A PNG or
// WebP keeps its type, so a transparent background stays transparent; anything
// else becomes a JPEG. Small files are sent as they are: the server re-encodes
// every upload anyway (lib/media/prepareImage.ts).
async function shrinkLogo(file: File): Promise<File> {
  if (file.size <= LOGO_MAX_BYTES) return file
  const type = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg'
  return new Promise((resolve) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, LOGO_MAX_EDGE / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(img.width * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(file)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file)
          const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
          resolve(new File([blob], file.name.replace(/\.\w+$/, `.${ext}`), { type }))
        },
        type,
        0.9
      )
    }
    img.onerror = () => resolve(file)
    img.src = url
  })
}

/**
 * The logo at the top of the Photos card (ticket 185): the logo as the page
 * shows it, and ways to change or remove it. Creator pages call it a profile
 * photo, as the checklist does.
 */
export function LogoPanel({
  listingId,
  logoUrl,
  creator = false,
  claimed = true,
}: {
  listingId: string
  /** The current logo's public address, or null for none. */
  logoUrl: string | null
  creator?: boolean
  /** False until the page is approved: the logo is saved but not shown yet. */
  claimed?: boolean
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, startBusy] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const noun = creator ? 'profile photo' : 'logo'
  const title = creator ? 'Profile Photo' : 'Logo'

  function upload(file: File) {
    setError(null)
    startBusy(async () => {
      const ready = await shrinkLogo(file)
      if (ready.size > LOGO_MAX_BYTES) {
        setError(`That image is too large. Use one under 2 MB.`)
        return
      }
      const fd = new FormData()
      fd.append('file', ready, ready.name)
      fd.append('bucket', 'listing-media')
      fd.append('entity_id', listingId)
      fd.append('media_role', 'logo')
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const body = (await res.json()) as { error?: string; data?: { path?: string } }
        if (!res.ok || !body.data?.path) {
          setError(body.error ?? 'Upload failed. Please try again.')
          return
        }
        const result = await setLogoAction({ listingId, path: body.data.path })
        if (result.ok) router.refresh()
        else setError(result.error)
      } catch {
        setError('Upload failed. Please check your connection and try again.')
      }
    })
  }

  return (
    <div className="rounded-lg border border-charcoal/12 bg-white p-4" data-testid="logo-panel">
      <p className="font-subhead text-sm font-bold text-brand-black">{title}</p>
      <p className="mt-0.5 font-body text-xs text-charcoal-soft">
        {creator
          ? 'Shown beside your name at the top of your page and on the map.'
          : 'Shown beside your business name at the top of your page and on the map.'}{' '}
        {LOGO_SIZE_TIP}, with a little space around the edges.
      </p>

      <div className="mt-3 flex items-center gap-4">
        <span className="relative inline-flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-charcoal/5 ring-1 ring-charcoal/10">
          {logoUrl ? (
            // Unoptimized: an older logo may be a full address on a host next/image does not allow.
            <Image
              src={logoUrl}
              alt={`Your ${noun}`}
              fill
              sizes="80px"
              unoptimized
              className="object-cover"
            />
          ) : (
            <ImagePlus className="size-6 text-charcoal/30" aria-hidden="true" />
          )}
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-black px-3 font-subhead text-xs font-semibold text-white hover:bg-charcoal disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="size-3.5" aria-hidden="true" />
            )}
            {logoUrl ? `Upload a New ${title}` : `Upload a ${title}`}
          </button>
          {logoUrl && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!window.confirm(`Remove your ${noun}?`)) return
                setError(null)
                startBusy(async () => {
                  const result = await setLogoAction({ listingId, path: null })
                  if (result.ok) router.refresh()
                  else setError(result.error)
                })
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 font-subhead text-xs font-semibold text-charcoal-soft hover:bg-charcoal/5 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" aria-hidden="true" /> Remove
            </button>
          )}
        </div>
      </div>

      <p className="mt-2 font-body text-xs text-charcoal-faint">
        {claimed
          ? `Your ${noun} doesn’t count toward your plan’s photos.`
          : `Your ${noun} shows on your page once it is approved. It doesn’t count toward your plan’s photos.`}
      </p>
      {error && (
        <p role="alert" className="mt-2 font-body text-xs text-red-700">
          {error}
        </p>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={`Choose a ${noun}`}
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) upload(file)
        }}
      />
    </div>
  )
}
