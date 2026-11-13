'use client'

import { useActionState, useRef, useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { sendMessageAction, type SendMessageState } from '@/lib/actions/messaging/sendMessage'
import { MESSAGE_MAX_LENGTH } from '@/lib/messaging/constants'

export function ReplyBox({ conversationId }: { conversationId: string }) {
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

  return (
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
      <div className="flex justify-between gap-3 font-body text-xs text-charcoal-soft">
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
  )
}
