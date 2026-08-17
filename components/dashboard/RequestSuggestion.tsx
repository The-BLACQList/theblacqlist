'use client'

import { useActionState } from 'react'
import { Loader2, Sparkles, AlertCircle } from 'lucide-react'
import { AI_AGENTS, type AgentDefinition } from '@/lib/ai/agents'
import { generateSuggestionAction } from '@/lib/actions/ai/generateSuggestion'

interface Props {
  listingId: string
}

/**
 * One request form per agent, each with its own pending state.
 *
 * A single dropdown with one submit button would be less markup, but it would
 * also mean the owner picks blind: the blurb is the only thing that explains the
 * difference between "SEO description" and "Business description", and it has to
 * be readable at the moment of choosing, not after.
 */
function AgentCard({ listingId, agent }: { listingId: string; agent: AgentDefinition }) {
  const [state, formAction, isPending] = useActionState(generateSuggestionAction, null)

  return (
    <form action={formAction} className="px-5 py-4">
      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="agent_type" value={agent.agentType} />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-body text-sm font-semibold text-brand-black">{agent.label}</p>
          <p className="font-body text-xs text-charcoal-soft mt-0.5">{agent.blurb}</p>
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-charcoal/15 bg-white font-body text-xs font-bold text-brand-black hover:bg-pale-lavender/40 disabled:opacity-50 transition-colors"
        >
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="size-3.5" aria-hidden="true" />
          )}
          {isPending ? 'Writing…' : 'Request'}
        </button>
      </div>

      {state && 'error' in state && (
        <p
          role="alert"
          className="flex items-start gap-1.5 font-body text-xs text-red-600 mt-2.5"
        >
          <AlertCircle className="size-3.5 shrink-0 mt-px" aria-hidden="true" />
          {state.error}
        </p>
      )}
      {state && 'success' in state && (
        <p role="status" className="font-body text-xs text-green-700 mt-2.5">
          Added below for your review.
        </p>
      )}
    </form>
  )
}

export function RequestSuggestion({ listingId }: Props) {
  return (
    <div className="rounded-xl border border-charcoal/10 bg-white divide-y divide-charcoal/5">
      {AI_AGENTS.map((agent) => (
        <AgentCard key={agent.agentType} listingId={listingId} agent={agent} />
      ))}
    </div>
  )
}
