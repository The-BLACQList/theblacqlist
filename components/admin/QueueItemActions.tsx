'use client'

import { useActionState } from 'react'
import { resolveQueueItemAction } from '@/lib/actions/admin/resolveQueueItem'

interface Props {
  queueId: string
  revalidatePath?: string
}

export function QueueItemActions({ queueId, revalidatePath = '/admin/reports' }: Props) {
  const [resolveState, resolveDispatch, resolvePending] = useActionState(
    resolveQueueItemAction,
    null
  )
  const [dismissState, dismissDispatch, dismissPending] = useActionState(
    resolveQueueItemAction,
    null
  )

  const isPending = resolvePending || dismissPending
  const error =
    (resolveState as { error?: string } | null)?.error ??
    (dismissState as { error?: string } | null)?.error

  return (
    <div className="flex items-center gap-2">
      {error && <p className="font-body text-xs text-red-600">{error}</p>}
      <form action={resolveDispatch}>
        <input type="hidden" name="queue_id" value={queueId} />
        <input type="hidden" name="decision" value="resolved" />
        <input type="hidden" name="revalidate_path" value={revalidatePath} />
        <button
          type="submit"
          disabled={isPending}
          className="font-subhead text-xs font-semibold text-green-700 hover:text-green-900 disabled:opacity-50"
        >
          Resolve
        </button>
      </form>
      <span className="text-charcoal/20">·</span>
      <form action={dismissDispatch}>
        <input type="hidden" name="queue_id" value={queueId} />
        <input type="hidden" name="decision" value="dismissed" />
        <input type="hidden" name="revalidate_path" value={revalidatePath} />
        <button
          type="submit"
          disabled={isPending}
          className="font-subhead text-xs font-semibold text-charcoal/50 hover:text-charcoal disabled:opacity-50"
        >
          Dismiss
        </button>
      </form>
    </div>
  )
}
