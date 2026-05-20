'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { withdrawClaimAction } from '@/lib/actions/claims/withdrawClaim'

interface Props {
  claimId: string
}

export function ClaimWithdrawButton({ claimId }: Props) {
  const [state, formAction, isPending] = useActionState(withdrawClaimAction, null)

  if (state && 'success' in state) {
    return <span className="font-subhead text-xs text-charcoal/60">Withdrawn</span>
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!window.confirm('Are you sure you want to withdraw this claim? This cannot be undone.')) {
      e.preventDefault()
    }
  }

  return (
    <div className="space-y-1">
      <form action={formAction} onSubmit={handleSubmit}>
        <input type="hidden" name="claim_id" value={claimId} />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal/60 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
          {isPending ? 'Withdrawing…' : 'Withdraw claim'}
        </button>
      </form>
      {state && 'error' in state && (
        <p role="alert" className="font-body text-xs text-red-600">
          {state.error}
        </p>
      )}
    </div>
  )
}
