'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, ImageIcon, Share2, Sparkles } from 'lucide-react'

import { ShareSheet } from '@/components/share/ShareSheet'
import { CameraViewfinder, type CapturedFrame } from '@/components/support-share/CameraViewfinder'
import { track } from '@/lib/analytics/client'
import { ANALYTICS_EVENTS } from '@/lib/analytics/constants'
import {
  composeSupportCard,
  drawSupportCard,
  loadImage,
  loadSupportAssets,
  SUPPORT_CARD_SIZES,
  type SupportCardAssets,
  type SupportFormat,
  type SupportPhoto,
} from '@/lib/share/composeSupportCard'
import type { SupportPost } from '@/lib/share/supportCard'
import { cn } from '@/lib/utils'

interface Props {
  post: SupportPost
}

type Step = 'choose' | 'camera' | 'preview'

/** Long side kept for a chosen photo. Enough for a 1080×1920 crop, light enough to redraw while dragging. */
const MAX_PHOTO_SIDE = 2400

const primaryBtnCls =
  'inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-sm transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60'

const choiceCls =
  'flex items-center gap-3 w-full min-h-14 px-4 rounded-xl border border-charcoal/15 bg-white hover:bg-charcoal/5 text-left font-subhead text-sm font-semibold text-brand-black transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60 cursor-pointer'

const linkCls =
  'inline-flex items-center min-h-11 font-subhead text-sm font-semibold text-amber-700 underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60 rounded'

/** Copy any drawable into a canvas no larger than MAX_PHOTO_SIDE. */
function downscale(image: CanvasImageSource, width: number, height: number): CapturedFrame {
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
  return { image: canvas, width: canvas.width, height: canvas.height }
}

/**
 * The support post studio (ticket 183): take a photo, pick one from the
 * camera roll, or use the brand card; see it framed; share it. The photo is
 * drawn in the browser and never uploaded.
 */
export function SupportPostStudio({ post }: Props) {
  const [step, setStep] = useState<Step>('choose')
  const [photo, setPhoto] = useState<SupportPhoto | null>(null)
  const [format, setFormat] = useState<SupportFormat>('story')
  const [assets, setAssets] = useState<SupportCardAssets | null>(null)
  const [error, setError] = useState('')
  const [cameraFallback, setCameraFallback] = useState(false)
  const [sheetImages, setSheetImages] = useState<Record<SupportFormat, Blob> | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [preparing, setPreparing] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const drag = useRef<{ x: number; y: number; pointer: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    loadSupportAssets().then((a) => {
      if (!cancelled) setAssets(a)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Redraw the preview whenever anything on the card changes.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !assets || step !== 'preview') return
    drawSupportCard(ctx, format, post, photo, assets)
  }, [assets, format, photo, post, step])

  function applyPhoto(frame: { image: CanvasImageSource; width: number; height: number }) {
    const small = downscale(frame.image, frame.width, frame.height)
    setPhoto({ ...small, focusX: 0.5, focusY: 0.5 })
    setSheetImages(null)
    setError('')
    setStep('preview')
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const url = URL.createObjectURL(file)
    try {
      const img = await loadImage(url)
      applyPhoto({ image: img, width: img.naturalWidth, height: img.naturalHeight })
    } catch {
      setError("We couldn't open that photo. Try a JPG or PNG, or take one now.")
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  function chooseBrandCard() {
    setPhoto(null)
    setSheetImages(null)
    setError('')
    setStep('preview')
  }

  const onCameraUnavailable = useCallback((reason: 'denied' | 'missing') => {
    setStep('choose')
    setCameraFallback(true)
    setError(
      reason === 'denied'
        ? "The camera is blocked for this site. Use your phone's camera instead, or turn camera access on in your browser settings."
        : "We couldn't find a camera. Use your phone's camera or pick a photo instead."
    )
  }, [])

  // ── Drag to move the photo inside the frame ───────────────────────────────
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!photo) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, pointer: e.pointerId }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = drag.current
    if (!photo || !d || d.pointer !== e.pointerId) return
    const rect = e.currentTarget.getBoundingClientRect()
    const { width: W, height: H } = SUPPORT_CARD_SIZES[format]
    const scale = Math.max(W / photo.width, H / photo.height)
    const overflowX = photo.width * scale - W
    const overflowY = photo.height * scale - H
    const dx = (e.clientX - d.x) * (W / rect.width)
    const dy = (e.clientY - d.y) * (H / rect.height)
    drag.current = { ...d, x: e.clientX, y: e.clientY }
    setPhoto(
      (p) =>
        p && {
          ...p,
          focusX: overflowX > 0 ? Math.min(1, Math.max(0, p.focusX - dx / overflowX)) : p.focusX,
          focusY: overflowY > 0 ? Math.min(1, Math.max(0, p.focusY - dy / overflowY)) : p.focusY,
        }
    )
    setSheetImages(null)
  }

  function onPointerUp() {
    drag.current = null
  }

  // Arrow keys move the photo too, for anyone not using a pointer.
  function onKeyDown(e: React.KeyboardEvent<HTMLCanvasElement>) {
    if (!photo) return
    const nudge = 0.05
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [nudge, 0],
      ArrowRight: [-nudge, 0],
      ArrowUp: [0, nudge],
      ArrowDown: [0, -nudge],
    }
    const m = moves[e.key]
    if (!m) return
    e.preventDefault()
    setPhoto(
      (p) =>
        p && {
          ...p,
          focusX: Math.min(1, Math.max(0, p.focusX + m[0])),
          focusY: Math.min(1, Math.max(0, p.focusY + m[1])),
        }
    )
    setSheetImages(null)
  }

  async function openShare() {
    if (!assets) return
    track({
      event_name: ANALYTICS_EVENTS.SHARE_SHEET_OPENED,
      entity_type: 'listing',
      entity_id: post.listingId,
      properties: { source: 'support_post', stage: post.stage, photo: photo ? 'yes' : 'no' },
    })
    if (sheetImages) {
      setSheetOpen(true)
      return
    }
    setPreparing(true)
    try {
      const [story, feed] = await Promise.all([
        composeSupportCard('story', post, photo, assets),
        composeSupportCard('feed', post, photo, assets),
      ])
      setSheetImages({ story, feed })
      setSheetOpen(true)
    } catch {
      setError("We couldn't make the post. Try again.")
    } finally {
      setPreparing(false)
    }
  }

  const { width: W, height: H } = SUPPORT_CARD_SIZES[format]
  const cardDescription = [
    `I supported ${post.businessLabel}`,
    post.cityLabel,
    post.dateLabel,
    post.stage === 'verified' ? 'Verified by The BLACQList' : null,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="flex flex-col gap-5">
      {/* Hidden inputs: the phone's camera app, and the camera roll. */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={onFile}
      />

      {step === 'camera' && (
        <CameraViewfinder
          businessLabel={post.businessLabel}
          onCapture={applyPhoto}
          onCancel={() => setStep(photo ? 'preview' : 'choose')}
          onUnavailable={onCameraUnavailable}
        />
      )}

      {step === 'choose' && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className={choiceCls}
            onClick={() => {
              setError('')
              if (cameraFallback) cameraInputRef.current?.click()
              else setStep('camera')
            }}
          >
            <Camera className="size-5 text-amber-700" aria-hidden="true" />
            Take a photo
            <span className="ml-auto font-body text-xs font-normal text-charcoal-soft">
              you, your order, the spot
            </span>
          </button>
          <label className={cn(choiceCls, 'focus-within:ring-2 focus-within:ring-amber-gold/60')}>
            <ImageIcon className="size-5 text-amber-700" aria-hidden="true" />
            Choose from camera roll
            <span className="ml-auto font-body text-xs font-normal text-charcoal-soft">
              a photo from your visit
            </span>
            <input type="file" accept="image/*" className="sr-only" onChange={onFile} />
          </label>
          <button type="button" className={choiceCls} onClick={chooseBrandCard}>
            <Sparkles className="size-5 text-amber-700" aria-hidden="true" />
            No photo, use the brand card
          </button>
        </div>
      )}

      {step === 'preview' && (
        <div className="flex flex-col items-center gap-4">
          <div
            role="group"
            aria-label="Post size"
            className="inline-flex rounded-full border border-charcoal/15 p-1"
          >
            {(['story', 'feed'] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={format === f}
                onClick={() => setFormat(f)}
                className={cn(
                  'min-h-9 px-4 rounded-full font-subhead text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold/60',
                  format === f ? 'bg-brand-black text-white' : 'text-charcoal hover:bg-charcoal/5'
                )}
              >
                {f === 'story' ? 'Story' : 'Post'}
              </button>
            ))}
          </div>

          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            role="img"
            aria-label={`Your post: ${cardDescription}`}
            tabIndex={photo ? 0 : -1}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onKeyDown}
            className={cn(
              'w-full max-w-[360px] rounded-2xl bg-brand-black shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold',
              photo && 'cursor-grab active:cursor-grabbing touch-none'
            )}
          />
          {photo && (
            <p className="font-body text-xs text-charcoal-soft">
              Drag the photo to move it in the frame.
            </p>
          )}

          <button
            type="button"
            className={primaryBtnCls}
            onClick={openShare}
            disabled={!assets || preparing}
          >
            <Share2 className="size-4" aria-hidden="true" />
            {preparing ? 'Getting it ready…' : 'Share'}
          </button>
          <button type="button" className={linkCls} onClick={() => setStep('choose')}>
            {photo ? 'Change photo' : 'Add a photo'}
          </button>
        </div>
      )}

      <p role="status" aria-live="polite" className="font-body text-sm text-charcoal text-center">
        {error}
      </p>

      <p className="font-body text-xs text-charcoal-soft text-center">
        Your photo stays on your phone. We don&apos;t upload it, and the post never shows your
        receipt or what you spent.
      </p>

      {sheetImages && (
        <ShareSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Share your support"
          caption={post.caption}
          url={post.url}
          campaign="support_share"
          businessName={post.businessLabel}
          images={sheetImages}
          analytics={{
            entityId: post.listingId,
            entityType: 'listing',
            source: 'support_post',
          }}
        />
      )}
    </div>
  )
}
