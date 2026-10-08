'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLivePage, useSaveLabel } from './SaveLabel'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import {
  removeListingVideoAction,
  updateListingVideoAction,
} from '@/lib/actions/dashboard/updateListingVideo'
import { PlanLimitNote } from '@/components/dashboard/PlanLimitNote'
import { VideoUploadField } from '@/components/dashboard/VideoUploadField'
import { LISTING_VIDEO_BUCKET } from '@/lib/video/listingVideo'

interface Props {
  listingId: string
  videoEmbedUrl: string | null
  /** Storage path of a video the owner uploaded (ticket 130). */
  videoPath: string | null
  /** Public storage base, `${SUPABASE_URL}/storage/v1/object/public`. */
  storageUrl: string
  /** A video is a Starter feature (ticket 119). */
  locked: boolean
  showUpgrade: boolean
}

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Video</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          Upload your own video, or link one from YouTube or Vimeo. Your page shows one video.
        </p>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  )
}

/** The uploaded video, playable, with a two-step remove. */
function UploadedVideo({ listingId, src }: { listingId: string; src: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function remove() {
    setError(null)
    startTransition(async () => {
      const result = await removeListingVideoAction(listingId)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setConfirming(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-2">
      <div className="relative w-full aspect-video overflow-hidden rounded-lg bg-deep-bg">
        <video
          src={`${src}#t=0.1`}
          controls
          playsInline
          preload="metadata"
          className="absolute inset-0 size-full"
          aria-label="Your uploaded video"
        />
      </div>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-body text-sm text-charcoal mr-auto">Remove this video from your page?</p>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={isPending}
            className="h-9 px-3 rounded-lg font-subhead text-sm font-semibold text-charcoal-soft hover:text-brand-black hover:bg-charcoal/5"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={isPending}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-red-600 text-white font-subhead font-bold text-sm hover:bg-red-700 disabled:opacity-50"
          >
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Remove video
          </button>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="h-9 px-3 rounded-lg font-subhead text-sm font-semibold text-red-700 hover:bg-red-50"
          >
            Remove video
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="font-body text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}

export function VideoSection({
  listingId,
  videoEmbedUrl,
  videoPath,
  storageUrl,
  locked,
  showUpgrade,
}: Props) {
  const [state, formAction, isPending] = useActionState(updateListingVideoAction, null)
  const saveLabel = useSaveLabel()
  const live = useLivePage()

  if (locked && !videoEmbedUrl && !videoPath) {
    return (
      <SectionShell>
        <PlanLimitNote showUpgrade={showUpgrade}>
          A video is part of Starter. Upgrade to add one to your page.
        </PlanLimitNote>
      </SectionShell>
    )
  }

  return (
    <SectionShell>
      {locked && (
        <PlanLimitNote showUpgrade={showUpgrade}>
          A video is part of Starter. You can keep or remove the one you have. Changing it needs
          Starter.
        </PlanLimitNote>
      )}

      {videoPath && (
        <UploadedVideo
          // Remount on a new upload so the player loads the new file.
          key={videoPath}
          listingId={listingId}
          src={`${storageUrl}/${LISTING_VIDEO_BUCKET}/${videoPath}`}
        />
      )}

      {!locked && <VideoUploadField listingId={listingId} replacing={!!videoPath} live={live} />}

      {!(locked && videoPath) && (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="listing_id" value={listingId} />

          <div>
            <label
              htmlFor="video-url"
              className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
            >
              {locked ? 'Video link' : 'Or paste a YouTube or Vimeo link'}
            </label>
            <input
              id="video-url"
              name="video_embed_url"
              type="url"
              defaultValue={videoEmbedUrl ?? ''}
              placeholder="https://youtube.com/watch?v=… or https://vimeo.com/…"
              className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
            />
            <p className="font-body text-xs text-charcoal-soft mt-1">
              {videoPath
                ? 'Saving a link replaces the video you uploaded.'
                : 'Leave it blank and save to remove the link.'}
            </p>
          </div>

          {state && 'error' in state && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2"
            >
              <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
              <p className="font-body text-sm text-red-700">{state.error}</p>
            </div>
          )}
          {state && 'success' in state && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
              <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
              <p className="font-body text-sm text-green-700">Saved.</p>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {isPending ? 'Saving…' : saveLabel}
            </button>
          </div>
        </form>
      )}
    </SectionShell>
  )
}
