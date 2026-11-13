'use client'

import { useState, useTransition } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { createSavedReplyAction, deleteSavedReplyAction, type SavedReply } from '@/lib/actions/messaging/savedReplies'
import {
  MESSAGE_MAX_LENGTH,
  SAVED_REPLY_KINDS,
  SAVED_REPLY_KIND_LABELS,
  SAVED_REPLY_LIMIT,
  SAVED_REPLY_TITLE_MAX,
  type SavedReplyKind,
} from '@/lib/messaging/constants'

/**
 * Inbox settings → Saved replies (part H). The owner's own replies, offered as
 * chips in the reply box on threads of the chosen kind. Nothing here sends.
 */
export function SavedRepliesManager({ initial }: { initial: SavedReply[] }) {
  const [replies, setReplies] = useState(initial)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [kind, setKind] = useState<SavedReplyKind>('any')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const full = replies.length >= SAVED_REPLY_LIMIT

  function add(e: React.FormEvent) {
    e.preventDefault()
    setMessage(null)
    startTransition(async () => {
      const result = await createSavedReplyAction({ title, body, kind })
      if ('error' in result) {
        setMessage({ ok: false, text: result.error })
        return
      }
      setReplies((rs) => [...rs, result.reply])
      setTitle('')
      setBody('')
      setMessage({ ok: true, text: `Saved "${result.reply.title}".` })
    })
  }

  function remove(id: string) {
    setMessage(null)
    setDeletingId(id)
    startTransition(async () => {
      const result = await deleteSavedReplyAction(id)
      setDeletingId(null)
      if ('error' in result) {
        setMessage({ ok: false, text: result.error })
        return
      }
      setReplies((rs) => rs.filter((r) => r.id !== id))
    })
  }

  return (
    <div className="space-y-4">
      {replies.length === 0 ? (
        <p className="font-body text-sm text-charcoal-soft">
          No saved replies yet. Add one below, or use &ldquo;Save as reply&rdquo; under any reply you write.
        </p>
      ) : (
        <ul className="divide-y divide-charcoal/8 rounded-xl border border-charcoal/10">
          {replies.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="font-subhead text-sm font-semibold text-brand-black">
                  {r.title}{' '}
                  <span className="ml-1 rounded-full bg-charcoal/8 px-2 py-0.5 font-body text-[11px] font-normal text-charcoal-soft">
                    {SAVED_REPLY_KIND_LABELS[r.kind]}
                  </span>
                </p>
                <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap break-words font-body text-xs text-charcoal-soft">
                  {r.body}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(r.id)}
                disabled={isPending}
                aria-label={`Delete saved reply ${r.title}`}
                className="shrink-0 rounded-full p-1.5 text-charcoal-soft hover:bg-charcoal/5 hover:text-red-700 disabled:opacity-50"
              >
                {deletingId === r.id ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-4" aria-hidden="true" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="font-body text-xs text-charcoal-soft">
        {replies.length} of {SAVED_REPLY_LIMIT} saved
      </p>

      {full ? (
        <p className="font-body text-sm text-charcoal">You&apos;ve saved {SAVED_REPLY_LIMIT} replies. Delete one to add another.</p>
      ) : (
        <form onSubmit={add} className="space-y-3 rounded-xl bg-charcoal/5 px-3 py-3">
          <p className="font-subhead text-sm font-semibold text-brand-black">Add a reply</p>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[12rem] flex-1">
              <label htmlFor="new-reply-title" className="block font-subhead text-xs font-semibold text-charcoal">
                Name
              </label>
              <input
                id="new-reply-title"
                type="text"
                value={title}
                maxLength={SAVED_REPLY_TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Interview times"
                className="mt-1 w-full rounded-lg border border-charcoal/15 bg-white px-2.5 py-1.5 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
              />
            </div>
            <div>
              <label htmlFor="new-reply-kind" className="block font-subhead text-xs font-semibold text-charcoal">
                Offer it on
              </label>
              <select
                id="new-reply-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as SavedReplyKind)}
                className="mt-1 rounded-lg border border-charcoal/15 bg-white px-2.5 py-1.5 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
              >
                {SAVED_REPLY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {SAVED_REPLY_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="new-reply-body" className="block font-subhead text-xs font-semibold text-charcoal">
              Reply
            </label>
            <textarea
              id="new-reply-body"
              rows={3}
              value={body}
              maxLength={MESSAGE_MAX_LENGTH}
              onChange={(e) => setBody(e.target.value)}
              className="mt-1 w-full resize-y rounded-lg border border-charcoal/15 bg-white px-2.5 py-2 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
            />
          </div>
          <button
            type="submit"
            disabled={isPending || !title.trim() || !body.trim()}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-black px-4 py-1.5 font-subhead text-xs font-semibold text-white disabled:opacity-50"
          >
            {isPending && deletingId === null && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            Save reply
          </button>
        </form>
      )}

      <div aria-live="polite">
        {message && (
          <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'font-body text-xs text-charcoal-soft' : 'font-body text-xs text-red-700'}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}
