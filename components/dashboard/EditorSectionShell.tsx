"use client"

import { useActionState } from "react"
import { Loader2, CheckCircle, AlertCircle } from "lucide-react"
import type { UpdateListingContentState } from "@/lib/actions/dashboard/updateListingContent"
import type { UpdateCtaState } from "@/lib/actions/dashboard/updateCta"

type SaveState = UpdateListingContentState | UpdateCtaState

interface Props {
  title: string
  children: React.ReactNode
  listingId: string
  action: (prev: SaveState, formData: FormData) => Promise<SaveState>
}

export function EditorSectionShell({ title, children, listingId, action }: Props) {
  const [state, formAction, isPending] = useActionState(action, null)

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">{title}</h2>
      </div>
      <form action={formAction} className="px-5 py-4 space-y-4">
        <input type="hidden" name="listing_id" value={listingId} />

        {children}

        {/* Feedback */}
        {state && "error" in state && (
          <div role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-red-700">{state.error}</p>
          </div>
        )}
        {state && "success" in state && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
            <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-green-700">Saved successfully.</p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  )
}
