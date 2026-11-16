'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2 } from 'lucide-react'
import {
  renameAlbumAction,
  setPhotoAlbumAction,
  type AlbumActionState,
} from '@/lib/actions/dashboard/photoAlbums'
import { ALBUM_NAME_MAX, albumCounts } from '@/lib/listings/photoAlbums'
import { PlanLimitNote } from '@/components/dashboard/PlanLimitNote'

// Photo albums (ticket 193), the owner's side, inside the Photos editor:
// an Album field on each photo card, and one panel listing the page's albums
// with Rename and Remove. Filing needs Growth; a lower plan can still take
// photos out of albums and rename them, and keeps them for an upgrade.

export interface AlbumsProp {
  /** Photo id → album. */
  byId: Record<string, string>
  /** The page's plan lets it file photos (Growth and up). */
  canFile: boolean
}

const INPUT =
  'w-full h-7 px-2 rounded border border-charcoal/20 bg-white font-body text-xs text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40'
const SMALL_BUTTON =
  'inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded font-subhead text-xs font-semibold disabled:opacity-50'

function datalistId(listingId: string): string {
  return `photo-albums-${listingId}`
}

function useAlbumAction() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  function run(action: () => Promise<AlbumActionState>, after?: () => void) {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if ('error' in result) {
        setError(result.error)
        return
      }
      after?.()
      router.refresh()
    })
  }
  return { error, isPending, run }
}

/** The Album field on one photo card. Blank takes the photo out of its album. */
export function PhotoAlbumField({
  listingId,
  mediaId,
  album,
  canFile,
}: {
  listingId: string
  mediaId: string
  album: string | null
  canFile: boolean
}) {
  const [value, setValue] = useState(album ?? '')
  const { error, isPending, run } = useAlbumAction()
  // A lower plan sees the field only to take a photo out of its album.
  if (!canFile && !album) return null
  const dirty = value.trim() !== (album ?? '')
  const inputId = `album-${mediaId}`

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (dirty) run(() => setPhotoAlbumAction({ listingId, mediaId, album: value }))
      }}
    >
      <label
        htmlFor={inputId}
        className="block font-subhead text-[11px] font-semibold text-charcoal-soft mb-0.5"
      >
        Album (Optional)
      </label>
      <div className="flex gap-1">
        <input
          id={inputId}
          className={INPUT}
          list={canFile ? datalistId(listingId) : undefined}
          maxLength={ALBUM_NAME_MAX}
          placeholder={canFile ? 'Interior, Menu…' : ''}
          readOnly={!canFile && value !== ''}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {!canFile ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => setPhotoAlbumAction({ listingId, mediaId, album: '' }))}
            className={`${SMALL_BUTTON} border border-charcoal/20 bg-white text-charcoal`}
          >
            Remove
          </button>
        ) : (
          dirty && (
            <button
              type="submit"
              disabled={isPending}
              aria-label="Save album"
              className={`${SMALL_BUTTON} bg-brand-black text-white`}
            >
              {isPending ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-3" aria-hidden="true" />
              )}
            </button>
          )
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 font-body text-xs text-red-600">
          {error}
        </p>
      )}
    </form>
  )
}

function AlbumRow({ listingId, name, count }: { listingId: string; name: string; count: number }) {
  const [to, setTo] = useState(name)
  const { error, isPending, run } = useAlbumAction()
  const renamed = to.trim() !== '' && to.trim() !== name
  const inputId = `album-rename-${name}`

  return (
    <li className="py-2">
      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="sr-only">
          Album name
        </label>
        <input
          id={inputId}
          className={`${INPUT} flex-1`}
          maxLength={ALBUM_NAME_MAX}
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <span className="shrink-0 font-body text-xs text-charcoal-soft">
          {count} {count === 1 ? 'photo' : 'photos'}
        </span>
        {renamed && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => renameAlbumAction({ listingId, from: name, to }))}
            className={`${SMALL_BUTTON} bg-brand-black text-white`}
          >
            Rename
          </button>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (
              window.confirm(`Take every photo out of “${name}”? The photos stay on your page.`)
            ) {
              run(() => renameAlbumAction({ listingId, from: name, to: '' }))
            }
          }}
          className={`${SMALL_BUTTON} border border-charcoal/20 bg-white text-charcoal`}
        >
          Remove
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 font-body text-xs text-red-600">
          {error}
        </p>
      )}
    </li>
  )
}

/** The page's albums, with Rename and Remove, above the photo grid. */
export function PhotoAlbumsPanel({
  listingId,
  mediaIds,
  albums,
}: {
  listingId: string
  mediaIds: readonly string[]
  albums: AlbumsProp
}) {
  const counts = albumCounts(mediaIds, albums.byId)
  if (!albums.canFile && counts.length === 0) return null

  return (
    <section
      aria-labelledby={`albums-${listingId}`}
      className="rounded-lg border border-charcoal/10 px-4 py-3"
    >
      <h3
        id={`albums-${listingId}`}
        className="font-subhead text-sm font-semibold text-brand-black"
      >
        Photo Albums
      </h3>
      {!albums.canFile && (
        <div className="mt-2">
          <PlanLimitNote upgradeTo="Growth">
            Photo albums come with Growth. Your photos show ungrouped for now, and your albums come
            back when your page is on Growth or higher.
          </PlanLimitNote>
        </div>
      )}
      {albums.canFile && (
        <p className="mt-1 font-body text-xs text-charcoal-soft">
          Type an album name under a photo to file it. Your page shows album buttons once your
          photos sit in two or more albums.
        </p>
      )}
      {counts.length > 0 && (
        <ul className="mt-2 divide-y divide-charcoal/10">
          {counts.map((a) => (
            <AlbumRow key={a.name} listingId={listingId} name={a.name} count={a.count} />
          ))}
        </ul>
      )}
      {albums.canFile && (
        <datalist id={datalistId(listingId)}>
          {counts.map((a) => (
            <option key={a.name} value={a.name} />
          ))}
        </datalist>
      )}
    </section>
  )
}
