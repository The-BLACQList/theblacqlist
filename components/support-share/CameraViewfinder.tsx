'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, X } from 'lucide-react'

export interface CapturedFrame {
  image: HTMLCanvasElement
  width: number
  height: number
}

interface Props {
  /** Shown faintly in the frame so the shopper can see where the words go. */
  businessLabel: string
  onCapture: (frame: CapturedFrame) => void
  onCancel: () => void
  /** No camera, or permission refused. The studio offers the phone's camera app instead. */
  onUnavailable: (reason: 'denied' | 'missing') => void
}

type Facing = 'user' | 'environment'

/**
 * A live camera with the support-post frame over it (ticket 183). The picture
 * is drawn to a canvas in the browser and handed back; it is never uploaded.
 * The camera turns off as soon as a picture is taken or the view closes.
 */
export function CameraViewfinder({ businessLabel, onCapture, onCancel, onUnavailable }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<Facing>('user')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!navigator.mediaDevices?.getUserMedia) {
      onUnavailable('missing')
      return
    }
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          video.play().catch(() => {})
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const name = err instanceof DOMException ? err.name : ''
        onUnavailable(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'missing')
      })
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [facing, onUnavailable])

  function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    onCapture({ image: canvas, width: canvas.width, height: canvas.height })
  }

  return (
    <div className="relative mx-auto w-full max-w-[360px] aspect-[9/16] overflow-hidden rounded-2xl bg-brand-black">
      <video
        ref={videoRef}
        playsInline
        muted
        onLoadedMetadata={() => setReady(true)}
        aria-label="Camera preview"
        className={`absolute inset-0 size-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
      />

      {/* The frame: where the words land on the post. Decorative. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-black/85 to-transparent" />
        <div className="absolute left-5 right-5 bottom-24 text-left">
          <p className="font-subhead text-[10px] font-semibold tracking-[0.25em] text-amber-gold">
            I SUPPORTED
          </p>
          <p className="font-headline font-light text-2xl text-white/90 leading-tight line-clamp-2">
            {businessLabel}
          </p>
        </div>
        <div className="absolute inset-3 rounded-xl border border-amber-gold/40" />
      </div>

      <button
        type="button"
        onClick={onCancel}
        aria-label="Close camera"
        className="absolute top-3 left-3 inline-flex size-11 items-center justify-center rounded-full bg-black/50 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
      >
        <X className="size-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => {
          setReady(false)
          setFacing((f) => (f === 'user' ? 'environment' : 'user'))
        }}
        aria-label={facing === 'user' ? 'Use the back camera' : 'Use the front camera'}
        className="absolute top-3 right-3 inline-flex size-11 items-center justify-center rounded-full bg-black/50 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-gold"
      >
        <RefreshCw className="size-5" aria-hidden="true" />
      </button>

      <div className="absolute inset-x-0 bottom-5 flex justify-center">
        <button
          type="button"
          onClick={capture}
          disabled={!ready}
          aria-label="Take the photo"
          className="inline-flex size-16 items-center justify-center rounded-full border-4 border-white bg-amber-gold text-brand-black disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        >
          <Camera className="size-6" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
