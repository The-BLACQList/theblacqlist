"use client"

import { useActionState, useRef, useEffect } from "react"
import { Loader2, Plus, AlertCircle } from "lucide-react"
import { addServiceAction } from "@/lib/actions/dashboard/addService"

interface Props {
  listingId: string
}

export function AddOfferingForm({ listingId }: Props) {
  const [state, formAction, isPending] = useActionState(addServiceAction, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state && "success" in state) {
      formRef.current?.reset()
    }
  }, [state])

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h3 className="font-headline text-sm text-brand-black">Add a service or offering</h3>
      </div>
      <form ref={formRef} action={formAction} className="px-5 py-4 space-y-3">
        <input type="hidden" name="listing_id" value={listingId} />

        <div>
          <label htmlFor="svc-name" className="block font-subhead text-xs font-semibold text-charcoal/70 mb-1">
            Name <span aria-hidden="true">*</span>
          </label>
          <input
            id="svc-name"
            name="name"
            type="text"
            maxLength={200}
            required
            placeholder="e.g. Natural Hair Consultation"
            className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
        </div>

        <div>
          <label htmlFor="svc-desc" className="block font-subhead text-xs font-semibold text-charcoal/70 mb-1">
            Description <span className="font-normal text-charcoal/40">(optional)</span>
          </label>
          <textarea
            id="svc-desc"
            name="description"
            rows={2}
            placeholder="Brief description of this service…"
            className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/40 resize-none"
          />
        </div>

        <div>
          <label htmlFor="svc-price" className="block font-subhead text-xs font-semibold text-charcoal/70 mb-1">
            Price <span className="font-normal text-charcoal/40">(optional)</span>
          </label>
          <input
            id="svc-price"
            name="price_display"
            type="text"
            placeholder="e.g. $75, Starting at $50, Free"
            className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
          />
        </div>

        {state && "error" in state && (
          <div role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-red-700">{state.error}</p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button type="submit" disabled={isPending}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {isPending
              ? <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              : <Plus className="size-4" aria-hidden="true" />}
            {isPending ? "Adding…" : "Add service"}
          </button>
        </div>
      </form>
    </div>
  )
}
