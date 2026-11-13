'use client'

import { useActionState, useRef, useState, useTransition } from 'react'
import { BookmarkPlus, Loader2, Send } from 'lucide-react'
import { sendMessageAction, type SendMessageState } from '@/lib/actions/messaging/sendMessage'
import { createSavedReplyAction } from '@/lib/actions/messaging/savedReplies'
import { MESSAGE_MAX_LENGTH, SAVED_REPLY_TITLE_MAX } from '@/lib/messaging/constants'
import { insertReply, type ReplyOptions } from '@/lib/messaging/quickReplies'

interface Props {
  conversationId: string
  /** Owner side only: quick and saved replies. A chip fills the box; it never sends. */
  replies?: ReplyOptions
}

export function ReplyBox({ conversationId, replies }: Props) {
  const [body, setBody] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Clears the box after a successful send. The thread itself re-renders with
  // the new message because the action revalidates the thread path.
  const [state, formAction, isPending] = useActionState(
    async (prev: SendMessageState, formData: FormData) => {
      const result = await sendMessageAction(prev, formData)
      if (result && 'success' in result) {
        setBody('')
        textareaRef.current?.focus()
      }
      return result
    },
    null
  )

  const remaining = MESSAGE_MAX_LENGTH - body.length

  function pickReply(text: string) {
    const next = insertReply(body, text)
    setBody(next)
    // Cursor at the end so the owner can edit before sending.
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(next.length, next.length)
    })
  }

  const chips = replies
    ? [
        ...replies.quick.map((q) => ({ key: `q-${q.id}`, label: q.label, text: q.text })),
        ...replies.saved.map((r) => ({ key: `s-${r.id}`, label: r.title, text: r.body })),
      ]
    : []

  return (
    <div className="space-y-3">
      {chips.length > 0 && (
        <div>
          <p id="quick-replies-label" className="mb-1.5 font-subhead text-xs font-semibold text-charcoal-soft">
            Quick replies <span className="font-normal">(fills the box for you to edit)</span>
          </p>
          <ul aria-labelledby="quick-replies-label" className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  onClick={() => pickReply(c.text)}
                  title={c.text}
                  className="max-w-[16rem] truncate rounded-full border border-charcoal/15 bg-white px-3 py-1 font-subhead text-xs font-semibold text-charcoal hover:border-charcoal/40 hover:text-brand-black transition-colors"
                >
                  {c.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form action={formAction} className="space-y-2">
        <input type="hidden" name="conversation_id" value={conversationId} />
        <label htmlFor="reply-body" className="sr-only">
          Write a reply
        </label>
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            id="reply-body"
            name="body"
            rows={3}
            required
            maxLength={MESSAGE_MAX_LENGTH}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              // Cmd/Ctrl+Enter sends; plain Enter keeps its newline.
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && body.trim()) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder="Write a reply…"
            className="min-h-[3.5rem] flex-1 rounded-xl border border-charcoal/15 bg-white px-3 py-2.5 font-body text-sm text-brand-black placeholder:text-charcoal-soft/70 focus:outline-none focus:ring-2 focus:ring-amber-gold/40 resize-y"
          />
          <button
            type="submit"
            disabled={isPending || body.trim().length === 0}
            aria-label="Send reply"
            className="inline-flex items-center justify-center size-11 shrink-0 rounded-full bg-gold hover:bg-light-gold text-brand-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
        <div className="flex flex-wrap justify-between gap-3 font-body text-xs text-charcoal-soft">
          {state && 'error' in state ? (
            <p role="alert" className="text-red-700">
              {state.error}
            </p>
          ) : (
            <p>Ctrl or ⌘ + Enter to send.</p>
          )}
          {remaining < 200 && <p aria-live="polite">{remaining} characters left</p>}
        </div>
      </form>

      {replies && <SaveAsReply body={body} kind={replies.kind} />}
    </div>
  )
}

/**
 * "Save as reply": keeps what is in the box as a saved reply, offered on
 * threads of the same kind. Outside the send form, so it can never submit it.
 */
function SaveAsReply({ body, kind }: { body: string; kind: ReplyOptions['kind'] }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const hasBody = body.trim().length > 0

  function save() {
    startTransition(async () => {
      const result = await createSavedReplyAction({ title, body, kind })
      if ('error' in result) {
        setMessage({ ok: false, text: result.error })
        return
      }
      setMessage({ ok: true, text: `Saved "${result.reply.title}". It's now in your quick replies.` })
      setTitle('')
      setOpen(false)
    })
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3 font-body text-xs">
        <button
          type="button"
          disabled={!hasBody}
          onClick={() => {
            setMessage(null)
            setOpen(true)
          }}
          className="inline-flex items-center gap-1 font-subhead font-semibold text-charcoal-soft hover:text-brand-black underline underline-offset-2 disabled:no-underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <BookmarkPlus className="size-3.5" aria-hidden="true" />
          Save as reply
        </button>
        {message && (
          <p role={message.ok ? 'status' : 'alert'} className={message.ok ? 'text-charcoal-soft' : 'text-red-700'}>
            {message.text}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl bg-charcoal/5 px-3 py-2.5">
      <div className="min-w-[12rem] flex-1">
        <label htmlFor="saved-reply-title" className="block font-subhead text-xs font-semibold text-charcoal">
          Name this reply
        </label>
        <input
          id="saved-reply-title"
          type="text"
          value={title}
          maxLength={SAVED_REPLY_TITLE_MAX}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (title.trim() && !isPending) save()
            }
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="e.g. Interview times"
          className="mt-1 w-full rounded-lg border border-charcoal/15 bg-white px-2.5 py-1.5 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
        />
      </div>
      <button
        type="button"
        onClick={save}
        disabled={isPending || !title.trim() || !hasBody}
        className="inline-flex items-center gap-1.5 rounded-full bg-brand-black px-3.5 py-1.5 font-subhead text-xs font-semibold text-white disabled:opacity-50"
      >
        {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
        Save
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="rounded-full px-3 py-1.5 font-subhead text-xs font-semibold text-charcoal-soft hover:text-brand-black"
      >
        Cancel
      </button>
      {message && !message.ok && (
        <p role="alert" className="w-full font-body text-xs text-red-700">
          {message.text}
        </p>
      )}
    </div>
  )
}
