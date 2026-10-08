'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle, Film, Loader2 } from 'lucide-react'
import {
  finishListingVideoUploadAction,
  startListingVideoUploadAction,
} from '@/lib/actions/dashboard/updateListingVideo'
import {
  LISTING_VIDEO_ACCEPT,
  LISTING_VIDEO_MAX_BYTES,
  formatMegabytes,
  resolveListingVideoType,
} from '@/lib/video/listingVideo'

interface Props {
  listingId: string
  /** The page already has an uploaded video, so this picks its replacement. */
  replacing: boolean
  /** The page is public, so a finished upload shows there straight away. */
  live: boolean
}

type Phase = { kind: 'idle' } | { kind: 'uploading'; percent: number } | { kind: 'checking' }

/**
 * Sends the file straight to storage with the one-time URL the server issues
 * (ticket 130). XHR rather than fetch, because fetch can't report upload
 * progress, and a 50 MB video on a phone connection needs a progress bar.
 */
function putFile(
  url: string,
  file: File,
  type: string,
  onProgress: (percent: number) => void,
  xhrRef: React.RefObject<XMLHttpRequest | null>
): Promise<'ok' | 'failed' | 'cancelled'> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr
    xhr.open('PUT', url)
    xhr.setRequestHeader('content-type', type)
    xhr.setRequestHeader('cache-control', 'max-age=3600')
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300 ? 'ok' : 'failed')
    xhr.onerror = () => resolve('failed')
    xhr.onabort = () => resolve('cancelled')
    xhr.send(file)
  })
}

export function VideoUploadField({ listingId, replacing, live }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setDone(false)

    const type = resolveListingVideoType(file.type, file.name)
    if (!type) {
      setError('Choose an MP4, MOV, or WebM video.')
      return
    }
    if (file.size > LISTING_VIDEO_MAX_BYTES) {
      setError(
        `That video is ${formatMegabytes(file.size)}. Videos can be up to ${formatMegabytes(LISTING_VIDEO_MAX_BYTES)}, so trim it or save a smaller copy and try again.`
      )
      return
    }

    setPhase({ kind: 'uploading', percent: 0 })
    const started = await startListingVideoUploadAction(listingId, type, file.size)
    if ('error' in started) {
      setPhase({ kind: 'idle' })
      setError(started.error)
      return
    }

    const sent = await putFile(
      started.signedUrl,
      file,
      type,
      (percent) => setPhase({ kind: 'uploading', percent }),
      xhrRef
    )
    xhrRef.current = null
    if (sent !== 'ok') {
      setPhase({ kind: 'idle' })
      if (sent === 'failed') setError('The upload stopped. Check your connection and try again.')
      return
    }

    setPhase({ kind: 'checking' })
    const finished = await finishListingVideoUploadAction(listingId, started.path)
    setPhase({ kind: 'idle' })
    if ('error' in finished) {
      setError(finished.error)
      return
    }
    setDone(true)
    router.refresh()
  }

  const busy = phase.kind !== 'idle'

  return (
    <div className="space-y-3">
      {phase.kind === 'idle' ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-lg border-2 border-dashed border-charcoal/20 px-4 py-6 text-center hover:border-amber-gold/40 hover:bg-amber-gold/5 transition-colors group"
        >
          <Film
            className="size-7 text-charcoal/25 group-hover:text-amber/50 mx-auto mb-2 transition-colors"
            aria-hidden="true"
          />
          <p className="font-subhead text-sm font-semibold text-charcoal-soft">
            {replacing ? 'Choose a new video' : 'Upload a video'}
          </p>
          <p className="font-body text-xs text-charcoal-soft mt-0.5">
            MP4, MOV or WebM, up to {formatMegabytes(LISTING_VIDEO_MAX_BYTES)}
          </p>
        </button>
      ) : (
        <div className="rounded-lg border border-charcoal/15 px-4 py-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p
              aria-live="polite"
              className="flex items-center gap-2 font-subhead text-sm font-semibold text-charcoal"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {phase.kind === 'checking' ? 'Checking your video…' : `Uploading… ${phase.percent}%`}
            </p>
            {phase.kind === 'uploading' && (
              <button
                type="button"
                onClick={() => xhrRef.current?.abort()}
                className="h-9 px-3 rounded-lg font-subhead text-sm font-semibold text-charcoal-soft hover:text-brand-black hover:bg-charcoal/5"
              >
                Cancel
              </button>
            )}
          </div>
          <progress
            max={100}
            value={phase.kind === 'uploading' ? phase.percent : undefined}
            aria-label="Video upload progress"
            className="w-full h-2 overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-charcoal/10 [&::-webkit-progress-value]:bg-amber-gold [&::-moz-progress-bar]:bg-amber-gold"
          />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={LISTING_VIDEO_ACCEPT}
        onChange={handleFile}
        disabled={busy}
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a video to upload"
      />

      {live && phase.kind === 'idle' && !done && (
        <p className="font-body text-xs text-charcoal-soft">
          Your video goes on your public page as soon as it finishes uploading.
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2"
        >
          <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
          <p className="font-body text-sm text-red-700">{error}</p>
        </div>
      )}
      {done && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2"
        >
          <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
          <p className="font-body text-sm text-green-700">
            {live ? 'Your video is on your page.' : 'Video saved.'}
          </p>
        </div>
      )}
    </div>
  )
}
