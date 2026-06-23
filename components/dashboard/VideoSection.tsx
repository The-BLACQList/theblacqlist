'use client'

import { useActionState } from 'react'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { updateListingVideoAction } from '@/lib/actions/dashboard/updateListingVideo'

interface Props {
  listingId: string
  videoEmbedUrl: string | null
}

export function VideoSection({ listingId, videoEmbedUrl }: Props) {
  const [state, formAction, isPending] = useActionState(updateListingVideoAction, null)

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Video</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          A YouTube or Vimeo link adds an embedded player to your page. Leave blank to remove.
        </p>
      </div>
      <form action={formAction} className="px-5 py-4 space-y-3">
        <input type="hidden" name="listing_id" value={listingId} />

        <div>
          <label
            htmlFor="video-url"
            className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
          >
            Video URL
          </label>
          <input
            id="video-url"
            name="video_embed_url"
            type="url"
            defaultValue={videoEmbedUrl ?? ''}
            placeholder="https://youtube.com/watch?v=… or https://vimeo.com/…"
            className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
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
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
