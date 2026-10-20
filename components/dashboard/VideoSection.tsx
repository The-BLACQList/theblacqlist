'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLivePage, useSaveLabel } from './SaveLabel'
import { Loader2, CheckCircle, AlertCircle, ArrowUp, ArrowDown, EyeOff } from 'lucide-react'
import {
  addListingVideoLinkAction,
  moveListingVideoAction,
  removeListingVideoAction,
} from '@/lib/actions/dashboard/updateListingVideo'
import { CollectiveSubmit, useSectionSave } from '@/components/listings/finish/ProfileSave'
import { PlanLimitNote } from '@/components/dashboard/PlanLimitNote'
import { VideoUploadField } from '@/components/dashboard/VideoUploadField'
import { LISTING_VIDEO_BUCKET } from '@/lib/video/listingVideo'
import { checkVideoAdd } from '@/lib/stripe/planChecks'
import { videoLimit } from '@/lib/stripe/features'
import type { FinishVideo } from '@/lib/listings/finishData'

interface Props {
  listingId: string
  /** The page's videos in the owner's order (ticket 105). */
  videos: FinishVideo[]
  tier: string | null
  /** Ids the public page leaves out after a move to a lower plan. */
  hiddenIds: ReadonlySet<string>
  /** Public storage base, `${SUPABASE_URL}/storage/v1/object/public`. */
  storageUrl: string
  showUpgrade: boolean
}

function intro(limit: number | null): string {
  const base = 'Upload your own video, or link one from YouTube or Vimeo.'
  if (limit === null) return `${base} Your page shows them in this order.`
  if (limit <= 1) return `${base} Your page shows one video.`
  return `${base} Your page shows up to ${limit}, in this order.`
}

function SectionShell({ limit, children }: { limit: number | null; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Video</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">{intro(limit)}</p>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  )
}

const ICON_BUTTON =
  'inline-flex items-center justify-center size-11 rounded-lg text-charcoal-soft hover:text-brand-black hover:bg-charcoal/5 disabled:opacity-40 disabled:hover:bg-transparent'

/** One video: a preview, its place in the order, and a two-step remove. */
function VideoItem({
  listingId,
  video,
  index,
  count,
  hidden,
  storageUrl,
}: {
  listingId: string
  video: FinishVideo
  index: number
  count: number
  hidden: boolean
  storageUrl: string
}) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const label = `Video ${index + 1} of ${count}`

  function run(change: () => Promise<{ success: true } | { error: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await change()
      if ('error' in result) {
        setError(result.error)
        return
      }
      setConfirming(false)
      router.refresh()
    })
  }

  return (
    <li className="space-y-2 rounded-lg border border-charcoal/10 p-3">
      <div className="flex items-center gap-2">
        <p className="font-subhead text-xs font-semibold text-charcoal-soft mr-auto">{label}</p>
        {hidden && (
          <span className="inline-flex items-center gap-1 rounded-full bg-pale-lavender px-2 py-0.5 font-subhead text-xs font-semibold text-charcoal">
            <EyeOff className="size-3" aria-hidden="true" />
            Hidden on your page
          </span>
        )}
        <button
          type="button"
          onClick={() => run(() => moveListingVideoAction(listingId, video.id, 'up'))}
          disabled={isPending || index === 0}
          aria-label={`Move ${label.toLowerCase()} up`}
          className={ICON_BUTTON}
        >
          <ArrowUp className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => run(() => moveListingVideoAction(listingId, video.id, 'down'))}
          disabled={isPending || index === count - 1}
          aria-label={`Move ${label.toLowerCase()} down`}
          className={ICON_BUTTON}
        >
          <ArrowDown className="size-4" aria-hidden="true" />
        </button>
      </div>

      {video.kind === 'file' && video.file_path ? (
        <div className="relative w-full aspect-video overflow-hidden rounded-lg bg-deep-bg">
          <video
            src={`${storageUrl}/${LISTING_VIDEO_BUCKET}/${video.file_path}#t=0.1`}
            controls
            playsInline
            preload="metadata"
            className="absolute inset-0 size-full"
            aria-label={`${label}, uploaded`}
          />
        </div>
      ) : (
        <p className="font-body text-sm text-charcoal break-all">{video.embed_url}</p>
      )}

      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-body text-sm text-charcoal mr-auto">
            Remove this video from your page?
          </p>
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
            onClick={() => run(() => removeListingVideoAction(listingId, video.id))}
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
            disabled={isPending}
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
    </li>
  )
}

/**
 * Adds one YouTube or Vimeo link. Keyed by the video list in the parent, so a
 * saved link remounts it empty and the page-wide save sees a clean form.
 */
function AddLinkForm({ listingId, hasVideos }: { listingId: string; hasVideos: boolean }) {
  const { state, pending, collective, formProps } = useSectionSave({
    id: 'video',
    label: 'Video link',
    action: addListingVideoLinkAction,
  })
  const saveLabel = useSaveLabel()

  return (
    <form {...formProps} className="space-y-3">
      <input type="hidden" name="listing_id" value={listingId} />

      <div>
        <label
          htmlFor="video-url"
          className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
        >
          Or paste a YouTube or Vimeo link
        </label>
        <input
          id="video-url"
          name="video_embed_url"
          type="url"
          defaultValue=""
          placeholder="https://youtube.com/watch?v=… or https://vimeo.com/…"
          className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
        />
        <p className="font-body text-xs text-charcoal-soft mt-1">
          {hasVideos ? 'A new link goes to the end of the list.' : 'Save to add it to your page.'}
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
      {!collective && state && 'success' in state && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
          <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
          <p className="font-body text-sm text-green-700">Video added.</p>
        </div>
      )}

      {collective ? (
        <CollectiveSubmit />
      ) : (
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {pending ? 'Saving…' : saveLabel}
          </button>
        </div>
      )}
    </form>
  )
}

export function VideoSection({
  listingId,
  videos,
  tier,
  hiddenIds,
  storageUrl,
  showUpgrade,
}: Props) {
  const live = useLivePage()
  const limit = videoLimit(tier)
  const full = checkVideoAdd(tier, videos.length)

  return (
    <SectionShell limit={limit}>
      {videos.length > 0 && (
        <ul className="space-y-3">
          {videos.map((video, i) => (
            <VideoItem
              key={video.id}
              listingId={listingId}
              video={video}
              index={i}
              count={videos.length}
              hidden={hiddenIds.has(video.id)}
              storageUrl={storageUrl}
            />
          ))}
        </ul>
      )}

      {full ? (
        <PlanLimitNote showUpgrade={showUpgrade}>{full}</PlanLimitNote>
      ) : (
        <>
          <VideoUploadField listingId={listingId} live={live} />
          <AddLinkForm
            key={videos.map((v) => v.id).join(',')}
            listingId={listingId}
            hasVideos={videos.length > 0}
          />
        </>
      )}
    </SectionShell>
  )
}
