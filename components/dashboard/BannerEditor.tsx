'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle, Crop, ImagePlus, Loader2, Monitor, Smartphone, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { setBannerAction } from '@/lib/actions/dashboard/setBanner'
import {
  BANNER_RATIO,
  BANNER_SIZE_TIP,
  MAX_ZOOM,
  SCREEN_RATIOS,
  backgroundFor,
  bannerCrop,
  bannerOutputSize,
  bannerQuality,
  cropCenter,
  visibleArea,
  type BannerQualityLevel,
  type Size,
} from '@/lib/media/banner'

// =============================================================================
// The banner: what it looks like, how sharp it is, and a 2:1 crop
// =============================================================================
// See lib/media/banner.ts for why 2:1 and the size rules. The crop is drawn
// from the original photo's pixels in the browser, uploaded as the cover
// (media_role=cover: no media row, not one of the plan's photos), then made
// the banner by setBannerAction.
// =============================================================================

/** A photo to crop: a file the owner just chose, or a stored photo. */
export interface BannerSource {
  url: string
  /** Stored photos come from another origin and need CORS to be drawn. */
  remote: boolean
}

const QUALITY_STYLE: Record<BannerQualityLevel, string> = {
  sharp: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  good: 'bg-amber-gold/10 text-brand-black border-amber-gold/40',
  soft: 'bg-red-50 text-red-700 border-red-200',
}

function QualityBadge({ width }: { width: number }) {
  const q = bannerQuality(width)
  return (
    <div className={cn('rounded-lg border px-3 py-2', QUALITY_STYLE[q.level])}>
      <p className="flex items-center gap-1.5 font-subhead text-xs font-bold">
        {q.level === 'soft' ? (
          <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <CheckCircle className="size-3.5 shrink-0" aria-hidden="true" />
        )}
        {q.label}
      </p>
      {q.tip && <p className="mt-0.5 font-body text-xs">{q.tip}</p>}
    </div>
  )
}

/** The photo's own size, once it loads. Null while loading or if it fails. */
function useImageSize(url: string | null): Size | null {
  const [size, setSize] = useState<{ url: string; size: Size } | null>(null)
  useEffect(() => {
    if (!url) return
    let live = true
    const img = new window.Image()
    // Loaded the same way as the crop, so a cached copy can still be drawn.
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (live) setSize({ url, size: { width: img.naturalWidth, height: img.naturalHeight } })
    }
    img.src = url
    return () => {
      live = false
    }
  }, [url])
  return size && size.url === url ? size.size : null
}

/** Loads `source` so it can be drawn on a canvas. */
function useCroppable(source: BannerSource | null) {
  const [state, setState] = useState<
    { url: string; img: HTMLImageElement; size: Size } | { url: string; failed: true } | null
  >(null)
  useEffect(() => {
    if (!source) return
    let live = true
    const img = new window.Image()
    if (source.remote) img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (live) setState({ url: source.url, img, size: { width: img.naturalWidth, height: img.naturalHeight } })
    }
    img.onerror = () => {
      if (live) setState({ url: source.url, failed: true })
    }
    img.src = source.url
    return () => {
      live = false
    }
  }, [source])
  return state && source && state.url === source.url ? state : null
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    } catch {
      // A stored photo served without CORS taints the canvas.
      resolve(null)
    }
  })
}

/**
 * Crop `source` to a 2:1 banner, preview it on a computer and a phone, and
 * save it as the page's banner. Key it by the source, so each photo starts
 * whole and centred.
 */
export function BannerCropDialog({
  listingId,
  source,
  onClose,
}: {
  listingId: string
  source: BannerSource | null
  onClose: () => void
}) {
  const router = useRouter()
  const loaded = useCroppable(source)
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState({ x: 0.5, y: 0.5 })
  const [error, setError] = useState<string | null>(null)
  const [saving, startSaving] = useTransition()
  const frameRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; center: { x: number; y: number } } | null>(null)

  const ready = loaded && 'img' in loaded ? loaded : null
  const size = ready?.size ?? null
  const crop = size ? bannerCrop(size, zoom, center) : null

  // Keeps the centre where the crop can actually be, so dragging past an edge
  // doesn't store a centre the next move has to undo.
  const moveTo = (next: { x: number; y: number }, z = zoom) => {
    if (!size) return
    setCenter(cropCenter(size, bannerCrop(size, z, next)))
  }

  const nudge = (dx: number, dy: number) => {
    if (!size || !crop) return
    moveTo({ x: center.x + (dx * crop.width) / size.width, y: center.y + (dy * crop.height) / size.height })
  }

  const save = () => {
    if (!ready || !crop) return
    setError(null)
    startSaving(async () => {
      const out = bannerOutputSize(crop)
      const canvas = document.createElement('canvas')
      canvas.width = out.width
      canvas.height = out.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setError('Your browser couldn’t crop this photo. Please try another browser.')
        return
      }
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(ready.img, crop.x, crop.y, crop.width, crop.height, 0, 0, out.width, out.height)
      const blob = await canvasBlob(canvas)
      if (!blob) {
        setError('We couldn’t crop this photo here. Download it and upload it as a new banner instead.')
        return
      }

      const fd = new FormData()
      fd.append('file', new File([blob], 'banner.jpg', { type: 'image/jpeg' }))
      fd.append('bucket', 'listing-media')
      fd.append('entity_id', listingId)
      fd.append('media_role', 'cover')
      let path: string | null = null
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const body = (await res.json()) as { data?: { path?: string }; error?: string }
        if (!res.ok || !body.data?.path) {
          setError(body.error ?? 'Upload failed. Please try again.')
          return
        }
        path = body.data.path
      } catch {
        setError('Upload failed. Please check your connection and try again.')
        return
      }

      const result = await setBannerAction({ listingId, path })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.refresh()
      onClose()
    })
  }

  const phoneShare = SCREEN_RATIOS.phone / BANNER_RATIO
  const failed = loaded && 'failed' in loaded

  return (
    <Dialog open={source !== null} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-headline text-lg text-brand-black">Crop your banner</DialogTitle>
          <DialogDescription className="font-body text-sm text-charcoal-soft">
            Drag to move, zoom to fill. Keep the main subject in the middle: phones show the part between the
            dashed lines.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-4">
          {failed ? (
            <p role="alert" className="font-body text-sm text-red-700">
              We couldn’t open this photo. Try another one, or upload it again.
            </p>
          ) : !ready || !crop || !size ? (
            <div className="flex aspect-[2/1] w-full items-center justify-center rounded-lg bg-charcoal/5">
              <Loader2 className="size-5 animate-spin text-charcoal-soft" aria-label="Loading photo" />
            </div>
          ) : (
            <>
              <div
                ref={frameRef}
                role="group"
                tabIndex={0}
                aria-label="Banner crop. Drag, or use the arrow keys, to move the photo. Plus and minus zoom."
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  drag.current = { x: e.clientX, y: e.clientY, center }
                }}
                onPointerMove={(e) => {
                  const start = drag.current
                  const frame = frameRef.current
                  if (!start || !frame) return
                  const perPx = crop.width / frame.clientWidth
                  moveTo({
                    x: start.center.x - ((e.clientX - start.x) * perPx) / size.width,
                    y: start.center.y - ((e.clientY - start.y) * perPx) / size.height,
                  })
                }}
                onPointerUp={() => {
                  drag.current = null
                }}
                onPointerCancel={() => {
                  drag.current = null
                }}
                onKeyDown={(e) => {
                  const step = e.shiftKey ? 0.1 : 0.02
                  if (e.key === 'ArrowLeft') nudge(-step, 0)
                  else if (e.key === 'ArrowRight') nudge(step, 0)
                  else if (e.key === 'ArrowUp') nudge(0, -step)
                  else if (e.key === 'ArrowDown') nudge(0, step)
                  else if (e.key === '+' || e.key === '=') {
                    const z = Math.min(MAX_ZOOM, zoom + 0.1)
                    setZoom(z)
                    moveTo(center, z)
                  } else if (e.key === '-') {
                    const z = Math.max(1, zoom - 0.1)
                    setZoom(z)
                    moveTo(center, z)
                  } else return
                  e.preventDefault()
                }}
                className="relative aspect-[2/1] w-full cursor-grab touch-none select-none overflow-hidden rounded-lg bg-charcoal/10 bg-no-repeat focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold active:cursor-grabbing"
                style={{ backgroundImage: `url("${ready.img.src}")`, ...backgroundFor(size, crop) }}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 border-x-2 border-dashed border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]"
                  style={{ left: `${((1 - phoneShare) / 2) * 100}%`, right: `${((1 - phoneShare) / 2) * 100}%` }}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-brand-black/70 px-2 py-0.5 font-subhead text-[11px] font-semibold text-white"
                >
                  Phones
                </span>
              </div>

              <label className="flex items-center gap-3 font-subhead text-xs font-semibold text-charcoal-soft">
                Zoom
                <input
                  type="range"
                  min={1}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => {
                    const z = Number(e.target.value)
                    setZoom(z)
                    moveTo(center, z)
                  }}
                  className="flex-1 accent-brand-black"
                />
              </label>

              <QualityBadge width={crop.width} />
              {size.height > size.width && (
                <p className="font-body text-xs text-charcoal-soft">
                  This photo is tall, so a wide banner keeps only a slice of it. A wide (landscape) photo works best.
                </p>
              )}

              <div className="flex items-end gap-3">
                <figure className="min-w-0 flex-1">
                  <div
                    className="w-full rounded-md bg-no-repeat"
                    style={{
                      aspectRatio: String(SCREEN_RATIOS.computer),
                      backgroundImage: `url("${ready.img.src}")`,
                      ...backgroundFor(size, visibleArea(crop, SCREEN_RATIOS.computer)),
                    }}
                  />
                  <figcaption className="mt-1 flex items-center gap-1 font-body text-xs text-charcoal-soft">
                    <Monitor className="size-3.5" aria-hidden="true" /> On a computer
                  </figcaption>
                </figure>
                <figure className="w-24 shrink-0">
                  <div
                    className="w-full rounded-md bg-no-repeat"
                    style={{
                      aspectRatio: String(SCREEN_RATIOS.phone),
                      backgroundImage: `url("${ready.img.src}")`,
                      ...backgroundFor(size, visibleArea(crop, SCREEN_RATIOS.phone)),
                    }}
                  />
                  <figcaption className="mt-1 flex items-center gap-1 font-body text-xs text-charcoal-soft">
                    <Smartphone className="size-3.5" aria-hidden="true" /> On a phone
                  </figcaption>
                </figure>
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="flex items-center gap-1.5 font-body text-sm text-red-700">
              <AlertCircle className="size-4 shrink-0" aria-hidden="true" /> {error}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-9 rounded-lg px-4 font-subhead text-sm font-semibold text-charcoal-soft hover:bg-charcoal/5 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!crop || saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-black px-4 font-subhead text-sm font-semibold text-white hover:bg-charcoal disabled:opacity-50"
            >
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Use as banner
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The banner at the top of the Photos card: the banner as a phone and a
 * computer would show it, how sharp it is, and ways to change it.
 */
export function BannerPanel({
  listingId,
  bannerUrl,
  onCrop,
}: {
  listingId: string
  /** The current banner's public address, or null for none. */
  bannerUrl: string | null
  onCrop: (source: BannerSource) => void
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const size = useImageSize(bannerUrl)
  const [removing, startRemoving] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const crop = size ? bannerCrop(size, 1, { x: 0.5, y: 0.5 }) : null

  return (
    <div className="rounded-lg border border-charcoal/12 bg-white p-4">
      <p className="font-subhead text-sm font-bold text-brand-black">Banner</p>
      <p className="mt-0.5 font-body text-xs text-charcoal-soft">
        The big photo across the top of your page. {BANNER_SIZE_TIP}, with the main subject in the middle.
      </p>

      {bannerUrl ? (
        <div className="mt-3 flex flex-col gap-3">
          <div
            className="relative aspect-[2/1] w-full overflow-hidden rounded-lg bg-charcoal/10 bg-cover bg-center"
            style={{ backgroundImage: `url("${bannerUrl}")` }}
            role="img"
            aria-label="Your banner"
          />
          {size && crop && <QualityBadge width={crop.width} />}
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-amber-gold/40 bg-amber-gold/10 px-3 py-2 font-body text-xs text-brand-black">
          No banner yet. Until you add one, your page and search results show a brand tile instead of your photo.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-black px-3 font-subhead text-xs font-semibold text-white hover:bg-charcoal"
        >
          <ImagePlus className="size-3.5" aria-hidden="true" />
          {bannerUrl ? 'Upload a new banner' : 'Upload a banner'}
        </button>
        {bannerUrl && (
          <>
            <button
              type="button"
              onClick={() => onCrop({ url: bannerUrl, remote: true })}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-charcoal/20 px-3 font-subhead text-xs font-semibold text-brand-black hover:bg-charcoal/5"
            >
              <Crop className="size-3.5" aria-hidden="true" /> Crop
            </button>
            <button
              type="button"
              disabled={removing}
              onClick={() => {
                if (!window.confirm('Remove your banner? Your page shows a brand tile until you add another.')) return
                setError(null)
                startRemoving(async () => {
                  const result = await setBannerAction({ listingId, path: null })
                  if (result.ok) router.refresh()
                  else setError(result.error)
                })
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 font-subhead text-xs font-semibold text-charcoal-soft hover:bg-charcoal/5 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" aria-hidden="true" /> Remove
            </button>
          </>
        )}
      </div>
      <p className="mt-2 font-body text-xs text-charcoal-faint">
        Or choose “Use as banner” on one of your photos below. The banner doesn’t count toward your plan’s photos.
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
        aria-label="Choose a banner photo"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onCrop({ url: URL.createObjectURL(file), remote: false })
        }}
      />
    </div>
  )
}
