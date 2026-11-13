'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, Loader2 } from 'lucide-react'
import { blockUserAction, unblockUserAction } from '@/lib/actions/messaging/blockUser'

interface Props {
  /** Needed to block; the blocked-customers list only unblocks. */
  conversationId?: string
  customerUserId: string
  blocked: boolean
  /** 'button' in a thread header, 'link' in the blocked-customers list. */
  variant?: 'button' | 'link'
}

/**
 * Owner-only. Blocking asks first; unblocking does not. Either way the page is
 * refreshed so the reply box and banner follow.
 */
export function BlockButton({ conversationId, customerUserId, blocked, variant = 'button' }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function run() {
    if (!blocked) {
      const ok = window.confirm(
        "Block this customer? They won't be able to message any of your businesses. They won't be told."
      )
      if (!ok) return
    }
    setError(null)
    startTransition(async () => {
      const result = blocked
        ? await unblockUserAction(customerUserId)
        : await blockUserAction(conversationId ?? '')
      if ('error' in result) setError(result.error)
      else router.refresh()
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className={
          variant === 'link'
            ? 'font-subhead text-xs font-semibold text-brand-black underline underline-offset-2 hover:text-charcoal disabled:opacity-50'
            : 'inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-charcoal/15 bg-white font-subhead text-xs font-semibold text-brand-black hover:bg-pale-lavender transition-colors disabled:opacity-50'
        }
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          variant === 'button' && <Ban className="size-3.5" aria-hidden="true" />
        )}
        {blocked ? 'Unblock' : 'Block'}
      </button>
      {error && (
        <span role="alert" className="font-body text-xs text-red-700">
          {error}
        </span>
      )}
    </span>
  )
}
