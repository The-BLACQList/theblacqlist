'use client'

import { useActionState } from 'react'
import { liftMessagingSuspensionAction, suspendMessagingAction } from '@/lib/actions/admin/suspendMessaging'

interface Props {
  queueId: string
  reportedUserId: string | null
  suspended: boolean
}

/**
 * Suspend works from the report (the user id is read from the queue item on
 * the server). Lift works on the user and shows whenever they are suspended,
 * including on already-resolved reports.
 */
export function MessagingSuspensionActions({ queueId, reportedUserId, suspended }: Props) {
  const [suspendState, suspendDispatch, suspendPending] = useActionState(suspendMessagingAction, null)
  const [liftState, liftDispatch, liftPending] = useActionState(liftMessagingSuspensionAction, null)
  const error =
    (suspendState && 'error' in suspendState ? suspendState.error : null) ??
    (liftState && 'error' in liftState ? liftState.error : null)

  if (!reportedUserId) return null

  return (
    <div className="flex items-center gap-2">
      {error && <p className="font-body text-xs text-red-600">{error}</p>}
      {suspended ? (
        <form action={liftDispatch}>
          <input type="hidden" name="user_id" value={reportedUserId} />
          <button
            type="submit"
            disabled={liftPending}
            className="font-subhead text-xs font-semibold text-charcoal-soft hover:text-charcoal disabled:opacity-50"
          >
            Lift suspension
          </button>
        </form>
      ) : (
        <form
          action={suspendDispatch}
          onSubmit={(e) => {
            if (!window.confirm('Suspend this user from messaging on every business? This also resolves the report.')) {
              e.preventDefault()
            }
          }}
        >
          <input type="hidden" name="queue_id" value={queueId} />
          <button
            type="submit"
            disabled={suspendPending}
            className="font-subhead text-xs font-semibold text-red-700 hover:text-red-900 disabled:opacity-50"
          >
            Suspend messaging
          </button>
        </form>
      )}
    </div>
  )
}
