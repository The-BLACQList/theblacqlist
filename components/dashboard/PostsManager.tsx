'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { EyeOff, ImagePlus, Loader2, Pencil, Square, Trash2, X } from 'lucide-react'
import {
  deletePostAction,
  endPostAction,
  savePostAction,
  type PostsState,
} from '@/lib/actions/dashboard/posts'
import { PlanLimitNote } from '@/components/dashboard/PlanLimitNote'
import { compressImage } from '@/components/dashboard/MediaGrid'
import { resolveMediaPath } from '@/lib/listings/coverImage'
import {
  DEFAULT_POST_BUTTON,
  POST_BODY_MAX,
  POST_BUTTON_LABEL_MAX,
  POST_HEADLINE_MAX,
  POST_MAX_DAYS,
  countsTowardLimit,
  endsLabel,
  postState,
  shownPosts,
  type OwnerPost,
  type PostState,
} from '@/lib/listings/happeningNow'
import { activePostLimit } from '@/lib/stripe/features'
import type { UpgradeTarget } from '@/lib/stripe/planChecks'

// Happening now posts (owner-experience round 2, part F): write a post, post
// it now or later, end it early, edit or delete it. Each change saves on its
// own and the list comes back from the server as saved.

interface Props {
  listingId: string
  initial: OwnerPost[]
  tier: string | null
  /** The plan the limit note offers (`upgradeTarget`), or null for no link. */
  upgradeTo: UpgradeTarget
  /** When the page was read, so the first render matches the server's. */
  initialNow: string
}

const DAY_MS = 24 * 60 * 60 * 1000
const LENGTHS = [
  { value: '1', label: '1 day' },
  { value: '3', label: '3 days' },
  { value: '7', label: '1 week' },
  { value: '14', label: '2 weeks' },
  { value: String(POST_MAX_DAYS), label: `${POST_MAX_DAYS} days` },
  { value: 'custom', label: 'Pick an end date' },
] as const

const STATE_BADGES: Record<PostState, { label: string; className: string }> = {
  live: { label: 'Live', className: 'bg-success/10 text-success' },
  scheduled: { label: 'Scheduled', className: 'bg-amber/10 text-amber' },
  draft: { label: 'Draft', className: 'bg-charcoal/8 text-charcoal' },
  ended: { label: 'Ended', className: 'bg-charcoal/8 text-charcoal-soft' },
}

const INPUT =
  'w-full px-3 py-2 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40'
const LABEL = 'block font-subhead text-xs font-semibold text-charcoal-soft mb-1'

/** An ISO time as a datetime-local value, in the owner's time zone. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function PostsManager({ listingId, initial, tier, upgradeTo, initialNow }: Props) {
  const [posts, setPosts] = useState(initial)
  const [now, setNow] = useState(() => new Date(initialNow))
  // null: the form writes a new post. The form is keyed on this, so switching
  // posts starts it fresh.
  const [editing, setEditing] = useState<OwnerPost | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const limit = activePostLimit(tier)
  const on = posts.filter((p) => countsTowardLimit(p, now)).length
  const hiddenIds = new Set(shownPosts(posts, tier, now).hidden.map((p) => p.id))
  const full = limit !== null && on >= limit

  function run(id: string, action: () => Promise<PostsState>) {
    setError(null)
    setBusyId(id)
    startTransition(async () => {
      const result = await action()
      setBusyId(null)
      setNow(new Date())
      if ('error' in result) {
        setError(result.error)
        return
      }
      setPosts(result.posts)
      if (editing && !result.posts.some((p) => p.id === editing.id)) setEditing(null)
    })
  }

  function saved(next: OwnerPost[]) {
    setPosts(next)
    setNow(new Date())
    setEditing(null)
    setFormKey((k) => k + 1)
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-charcoal/10 bg-white">
        <div className="px-5 py-4 border-b border-charcoal/8 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-headline text-base text-brand-black">
              {editing ? 'Edit post' : 'New post'}
            </h2>
            <p className="font-body text-xs text-charcoal-soft mt-0.5">
              A short note at the top of your page and in &ldquo;Happening now&rdquo; on your city
              page: a sale, a pop-up, a new menu. It comes down by itself when it ends.
            </p>
          </div>
          {editing && (
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="inline-flex items-center gap-1 font-subhead text-xs font-semibold text-charcoal-soft hover:text-brand-black"
            >
              <X className="size-3.5" aria-hidden="true" />
              Cancel
            </button>
          )}
        </div>
        <div className="px-5 py-4 space-y-4">
          {limit === 0 ? (
            <PlanLimitNote upgradeTo={upgradeTo}>
              Happening now posts are part of Starter. Upgrade to post one on your page. You can
              still write a draft now.
            </PlanLimitNote>
          ) : full && !(editing && countsTowardLimit(editing, now)) ? (
            <PlanLimitNote upgradeTo={upgradeTo}>
              {`Your plan includes ${limit === 1 ? '1 post' : `up to ${limit} posts`} at a time. ${
                upgradeTo
                  ? `End one, or upgrade to ${upgradeTo} for more.`
                  : 'End one to post another.'
              } You can still save a draft.`}
            </PlanLimitNote>
          ) : null}
          <PostForm
            key={editing ? editing.id : `new-${formKey}`}
            listingId={listingId}
            post={editing}
            now={now}
            onSaved={saved}
          />
        </div>
      </section>

      <section className="rounded-xl border border-charcoal/10 bg-white">
        <div className="px-5 py-4 border-b border-charcoal/8">
          <h2 className="font-headline text-base text-brand-black">Your posts</h2>
          <p className="font-body text-xs text-charcoal-soft mt-0.5">
            {limit === null
              ? 'Your plan has no limit on posts.'
              : limit === 0
                ? 'Paid plans can post.'
                : `Your plan shows ${limit === 1 ? '1 post' : `up to ${limit} posts`} at a time: ${on} on now.`}
          </p>
        </div>
        {error && (
          <p role="alert" className="mx-5 mt-4 font-body text-sm text-red-700">
            {error}
          </p>
        )}
        {posts.length === 0 ? (
          <p className="px-5 py-6 font-body text-sm text-charcoal-soft">No posts yet.</p>
        ) : (
          <ul className="divide-y divide-charcoal/8">
            {posts.map((post) => {
              const state = postState(post, now)
              const badge = STATE_BADGES[state]
              const busy = busyId === post.id
              return (
                <li key={post.id} className="flex gap-3 px-5 py-4">
                  {post.image_path && (
                    <Image
                      src={resolveMediaPath(post.image_path) ?? ''}
                      alt=""
                      width={48}
                      height={48}
                      className="size-12 shrink-0 rounded-md object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 font-subhead text-xs font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      {hiddenIds.has(post.id) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-pale-lavender px-2 py-0.5 font-subhead text-xs font-semibold text-charcoal">
                          <EyeOff className="size-3" aria-hidden="true" />
                          Hidden: over your plan&rsquo;s limit
                        </span>
                      )}
                      {/* Times are in the owner's time zone, which the server doesn't know. */}
                      <span
                        suppressHydrationWarning
                        className="font-body text-xs text-charcoal-soft"
                      >
                        {state === 'scheduled'
                          ? `Starts ${formatWhen(post.starts_at)}`
                          : state === 'live'
                            ? endsLabel(post.ends_at, now)
                            : state === 'draft'
                              ? `Would end ${formatWhen(post.ends_at)}`
                              : post.status === 'ended'
                                ? 'Ended early'
                                : `Ended ${formatWhen(post.ends_at)}`}
                      </span>
                    </div>
                    <p className="mt-1 font-subhead text-sm font-semibold text-brand-black break-words">
                      {post.headline}
                    </p>
                    {post.body && (
                      <p className="font-body text-xs text-charcoal-soft break-words">
                        {post.body}
                      </p>
                    )}
                    {post.button_url && (
                      <p className="mt-0.5 font-body text-xs text-charcoal-faint truncate">
                        {post.button_label || DEFAULT_POST_BUTTON} → {post.button_url}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-start gap-1">
                    <IconButton
                      label={`Edit “${post.headline}”`}
                      disabled={isPending}
                      onClick={() => {
                        setError(null)
                        setEditing(post)
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </IconButton>
                    {(state === 'live' || state === 'scheduled') && (
                      <IconButton
                        label={`End “${post.headline}” now`}
                        disabled={isPending}
                        onClick={() =>
                          run(post.id, () => endPostAction({ listingId, id: post.id }))
                        }
                      >
                        <Square className="size-4" aria-hidden="true" />
                      </IconButton>
                    )}
                    <IconButton
                      label={`Delete “${post.headline}”`}
                      disabled={isPending}
                      danger
                      onClick={() => {
                        if (!window.confirm('Delete this post? This can’t be undone.')) return
                        run(post.id, () => deletePostAction({ listingId, id: post.id }))
                      }}
                    >
                      {busy ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="size-4" aria-hidden="true" />
                      )}
                    </IconButton>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {hiddenIds.size > 0 && (
          <p className="px-5 pb-4 font-body text-xs text-charcoal-soft">
            Your page shows the {limit === 1 ? 'oldest one' : `${limit} oldest`}. End one to show
            the next. Nothing was deleted.
          </p>
        )}
      </section>
    </div>
  )
}

// ── The form ─────────────────────────────────────────────────────────────────

function PostForm({
  listingId,
  post,
  now,
  onSaved,
}: {
  listingId: string
  post: OwnerPost | null
  now: Date
  onSaved: (posts: OwnerPost[]) => void
}) {
  const [headline, setHeadline] = useState(post?.headline ?? '')
  const [body, setBody] = useState(post?.body ?? '')
  const [buttonLabel, setButtonLabel] = useState(post?.button_label ?? '')
  const [buttonUrl, setButtonUrl] = useState(post?.button_url ?? '')
  // A post that has started keeps its start unless the owner changes it.
  const started = post !== null && postState(post, now) === 'live'
  const [startLocal, setStartLocal] = useState(post && !started ? toLocalInput(post.starts_at) : '')
  const [length, setLength] = useState<string>(post ? 'custom' : '7')
  const [endLocal, setEndLocal] = useState(post ? toLocalInput(post.ends_at) : '')
  // undefined keeps the saved image, null removes it, a string is a new upload.
  const [imagePath, setImagePath] = useState<string | null | undefined>(undefined)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const shownImage =
    imagePath === undefined ? (post?.image_path ?? null) : imagePath === null ? null : imagePath

  async function upload(file: File) {
    setError(null)
    setUploading(true)
    try {
      const small = await compressImage(file, 1200, 0.85)
      const fd = new FormData()
      fd.append('file', small)
      fd.append('bucket', 'listing-media')
      fd.append('entity_id', listingId)
      fd.append('media_role', 'post')
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      const json = (await res.json()) as { data?: { path?: string }; error?: string }
      if (!res.ok || !json.data?.path) {
        setError(json.error ?? 'Upload failed. Please try again.')
        return
      }
      setImagePath(json.data.path)
    } catch {
      setError('Upload failed. Please check your connection and try again.')
    } finally {
      setUploading(false)
    }
  }

  function submit(publish: boolean) {
    setError(null)
    const startIso = startLocal
      ? new Date(startLocal).toISOString()
      : started && post
        ? post.starts_at
        : ''
    let endIso = ''
    if (length === 'custom') {
      endIso = endLocal ? new Date(endLocal).toISOString() : ''
    } else {
      const from = startLocal ? new Date(startLocal).getTime() : Date.now()
      endIso = new Date(from + Number(length) * DAY_MS).toISOString()
    }
    startTransition(async () => {
      const result = await savePostAction({
        listingId,
        id: post?.id,
        headline,
        body,
        buttonLabel,
        buttonUrl,
        startsAt: startIso,
        endsAt: endIso,
        imagePath,
        publish,
      })
      if ('error' in result) {
        setError(result.error)
        return
      }
      onSaved(result.posts)
    })
  }

  const busy = isPending || uploading
  const isOn = post !== null && countsTowardLimit(post, now)

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit(true)
      }}
    >
      <div>
        <label htmlFor="post-headline" className={LABEL}>
          Headline
        </label>
        <input
          id="post-headline"
          type="text"
          value={headline}
          maxLength={POST_HEADLINE_MAX}
          required
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="20% off all cupcakes this weekend"
          className={INPUT}
        />
        <Counter value={headline} max={POST_HEADLINE_MAX} />
      </div>

      <div>
        <label htmlFor="post-body" className={LABEL}>
          One more line <span className="font-normal text-charcoal-faint">(optional)</span>
        </label>
        <input
          id="post-body"
          type="text"
          value={body}
          maxLength={POST_BODY_MAX}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Walk in or order ahead. While they last."
          className={INPUT}
        />
        <Counter value={body} max={POST_BODY_MAX} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[11rem] flex-[2]">
          <label htmlFor="post-button-url" className={LABEL}>
            Button link <span className="font-normal text-charcoal-faint">(optional)</span>
          </label>
          <input
            id="post-button-url"
            type="url"
            value={buttonUrl}
            onChange={(e) => setButtonUrl(e.target.value)}
            placeholder="https://example.com/order"
            className={INPUT}
          />
        </div>
        <div className="min-w-[9rem] flex-1">
          <label htmlFor="post-button-label" className={LABEL}>
            Button words <span className="font-normal text-charcoal-faint">(optional)</span>
          </label>
          <input
            id="post-button-label"
            type="text"
            value={buttonLabel}
            maxLength={POST_BUTTON_LABEL_MAX}
            onChange={(e) => setButtonLabel(e.target.value)}
            placeholder={DEFAULT_POST_BUTTON}
            className={INPUT}
          />
        </div>
      </div>

      <div>
        <span className={LABEL}>
          Image <span className="font-normal text-charcoal-faint">(optional)</span>
        </span>
        <div className="flex items-center gap-3">
          {shownImage && (
            <Image
              src={resolveMediaPath(shownImage) ?? ''}
              alt=""
              width={56}
              height={56}
              className="size-14 rounded-md object-cover"
            />
          )}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-charcoal/20 px-3 py-1.5 font-subhead text-xs font-semibold text-brand-black hover:bg-charcoal/5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-gold/40">
            {uploading ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="size-3.5" aria-hidden="true" />
            )}
            {shownImage ? 'Change image' : 'Add an image'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) void upload(file)
              }}
            />
          </label>
          {shownImage && (
            <button
              type="button"
              onClick={() => setImagePath(null)}
              className="font-subhead text-xs font-semibold text-charcoal-soft hover:text-brand-black"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[11rem] flex-1">
          <label htmlFor="post-start" className={LABEL}>
            Starts
          </label>
          <input
            id="post-start"
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            className={INPUT}
          />
          <p className="mt-1 font-body text-xs text-charcoal-faint">
            {startLocal
              ? 'It goes up then by itself.'
              : started
                ? 'Already running.'
                : 'Leave blank to start now.'}
          </p>
        </div>
        <div className="min-w-[11rem] flex-1">
          <label htmlFor="post-length" className={LABEL}>
            Runs for
          </label>
          <select
            id="post-length"
            value={length}
            onChange={(e) => setLength(e.target.value)}
            className={INPUT}
          >
            {LENGTHS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          {length === 'custom' && (
            <>
              <label htmlFor="post-end" className="sr-only">
                Ends
              </label>
              <input
                id="post-end"
                type="datetime-local"
                value={endLocal}
                required
                onChange={(e) => setEndLocal(e.target.value)}
                className={`${INPUT} mt-2`}
              />
            </>
          )}
          <p className="mt-1 font-body text-xs text-charcoal-faint">Up to {POST_MAX_DAYS} days.</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="font-body text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-brand-black text-white font-subhead text-sm font-bold hover:bg-charcoal disabled:opacity-60"
        >
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isOn ? 'Save changes' : startLocal ? 'Schedule post' : 'Post now'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => submit(false)}
          className="h-10 px-4 rounded-full border border-charcoal/20 font-subhead text-sm font-semibold text-brand-black hover:bg-charcoal/5 disabled:opacity-60"
        >
          {isOn ? 'Take down and keep as draft' : 'Save draft'}
        </button>
      </div>
    </form>
  )
}

function Counter({ value, max }: { value: string; max: number }) {
  const left = max - value.length
  return (
    <p
      className={`mt-1 text-right font-body text-xs ${left < 10 ? 'text-amber' : 'text-charcoal-faint'}`}
    >
      {value.length}/{max}
    </p>
  )
}

function IconButton({
  label,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  danger?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex size-8 items-center justify-center rounded-full text-charcoal-soft disabled:opacity-40 ${
        danger ? 'hover:bg-red-50 hover:text-red-700' : 'hover:bg-charcoal/5 hover:text-brand-black'
      }`}
    >
      {children}
    </button>
  )
}
