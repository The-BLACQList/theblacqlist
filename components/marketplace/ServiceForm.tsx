"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { type CreateServiceState } from "@/lib/actions/marketplace/createService"
import { VALID_DELIVERY_MODES } from "@/lib/constants/marketplace"
import { type UpdateServiceState } from "@/lib/actions/marketplace/updateService"

interface ListingOption {
  id: string
  name: string
}

interface ServiceFormProps {
  action: (prev: CreateServiceState | UpdateServiceState | null, formData: FormData) => Promise<CreateServiceState | UpdateServiceState>
  listings: ListingOption[]
  defaultListingId?: string
  defaultValues?: {
    service_id?: string
    name?: string
    description?: string
    starting_price_dollars?: string
    price_display_text?: string
    duration_text?: string
    delivery_mode?: string
    booking_url?: string
    cover_image_url?: string
    status?: string
  }
  submitLabel?: string
}

const DELIVERY_LABELS: Record<string, string> = {
  virtual:   "Virtual",
  in_person: "In person",
  travel:    "Provider travels to client",
  hybrid:    "Virtual + in person",
}

export function ServiceForm({
  action,
  listings,
  defaultListingId,
  defaultValues,
  submitLabel = "Save service",
}: ServiceFormProps) {
  const router = useRouter()
  const [_state, formAction, isPending] = useActionState(action as Parameters<typeof useActionState>[0], null)
  const state = _state as CreateServiceState | UpdateServiceState

  useEffect(() => {
    if (state && "success" in state && state.success) {
      if ("globalSlug" in state) {
        router.push(`/dashboard/services?created=true`)
      } else {
        router.push(`/dashboard/services?updated=true`)
      }
    }
  }, [state, router])

  const fieldErrors: Partial<Record<string, string>> = (state && "fieldErrors" in state && state.fieldErrors) ? state.fieldErrors : {}

  return (
    <form action={formAction} className="space-y-5 max-w-xl">
      {defaultValues?.service_id && (
        <input type="hidden" name="service_id" value={defaultValues.service_id} />
      )}

      {state && "error" in state && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="font-subhead text-sm text-red-700">{state.error}</p>
        </div>
      )}

      {/* Listing selector */}
      <div className="space-y-1">
        <label htmlFor="listing_id" className="block font-subhead text-sm font-semibold text-brand-black">
          Listing <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <select
          id="listing_id"
          name="listing_id"
          required
          defaultValue={defaultListingId ?? ""}
          className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold"
          aria-describedby={fieldErrors.listing_id ? "listing-error" : undefined}
        >
          <option value="">Select a listing</option>
          {listings.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        {fieldErrors.listing_id && (
          <p id="listing-error" role="alert" className="font-body text-xs text-red-600">{fieldErrors.listing_id}</p>
        )}
      </div>

      {/* Name */}
      <div className="space-y-1">
        <label htmlFor="name" className="block font-subhead text-sm font-semibold text-brand-black">
          Service name <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={200}
          defaultValue={defaultValues?.name ?? ""}
          placeholder="e.g. Brand Identity Package"
          className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-amber-gold"
          aria-describedby={fieldErrors.name ? "name-error" : undefined}
        />
        {fieldErrors.name && (
          <p id="name-error" role="alert" className="font-body text-xs text-red-600">{fieldErrors.name}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label htmlFor="description" className="block font-subhead text-sm font-semibold text-brand-black">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={defaultValues?.description ?? ""}
          placeholder="What does this service include? Who is it for?"
          className="w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2 font-body text-sm text-brand-black placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-amber-gold resize-none"
        />
      </div>

      {/* Pricing */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="starting_price_cents" className="block font-subhead text-sm font-semibold text-brand-black">
            Starting price ($)
          </label>
          <input
            id="starting_price_cents"
            name="starting_price_cents"
            type="number"
            min="0"
            step="0.01"
            defaultValue={defaultValues?.starting_price_dollars ?? ""}
            placeholder="0.00"
            className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-amber-gold"
            aria-describedby={fieldErrors.starting_price_cents ? "price-error" : undefined}
          />
          {fieldErrors.starting_price_cents && (
            <p id="price-error" role="alert" className="font-body text-xs text-red-600">{fieldErrors.starting_price_cents}</p>
          )}
        </div>
        <div className="space-y-1">
          <label htmlFor="duration_text" className="block font-subhead text-sm font-semibold text-brand-black">
            Duration
          </label>
          <input
            id="duration_text"
            name="duration_text"
            type="text"
            maxLength={80}
            defaultValue={defaultValues?.duration_text ?? ""}
            placeholder='e.g. "1 hour" or "varies"'
            className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-amber-gold"
          />
        </div>
      </div>

      {/* Price display override */}
      <div className="space-y-1">
        <label htmlFor="price_display_text" className="block font-subhead text-sm font-semibold text-brand-black">
          Price display text <span className="font-normal text-charcoal/40">(optional override)</span>
        </label>
        <input
          id="price_display_text"
          name="price_display_text"
          type="text"
          maxLength={80}
          defaultValue={defaultValues?.price_display_text ?? ""}
          placeholder='e.g. "Starting at $500" or "Packages from $200"'
          className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-amber-gold"
        />
      </div>

      {/* Delivery mode */}
      <fieldset className="space-y-2">
        <legend className="font-subhead text-sm font-semibold text-brand-black">
          Delivery <span aria-hidden="true" className="text-red-500">*</span>
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {VALID_DELIVERY_MODES.map((mode) => (
            <label key={mode} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="delivery_mode"
                value={mode}
                defaultChecked={(defaultValues?.delivery_mode ?? "in_person") === mode}
                className="accent-amber-gold"
              />
              <span className="font-body text-sm text-charcoal">{DELIVERY_LABELS[mode]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Cover image URL */}
      <div className="space-y-1">
        <label htmlFor="cover_image_url" className="block font-subhead text-sm font-semibold text-brand-black">
          Cover image URL
        </label>
        <input
          id="cover_image_url"
          name="cover_image_url"
          type="url"
          defaultValue={defaultValues?.cover_image_url ?? ""}
          placeholder="https://..."
          className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-amber-gold"
          aria-describedby={fieldErrors.cover_image_url ? "image-error" : undefined}
        />
        {fieldErrors.cover_image_url && (
          <p id="image-error" role="alert" className="font-body text-xs text-red-600">{fieldErrors.cover_image_url}</p>
        )}
      </div>

      {/* Booking URL */}
      <div className="space-y-1">
        <label htmlFor="booking_url" className="block font-subhead text-sm font-semibold text-brand-black">
          Booking / request URL
        </label>
        <input
          id="booking_url"
          name="booking_url"
          type="url"
          defaultValue={defaultValues?.booking_url ?? ""}
          placeholder="https://calendly.com/yourname or https://yoursite.com/contact"
          className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-amber-gold"
          aria-describedby={fieldErrors.booking_url ? "booking-error" : undefined}
        />
        {fieldErrors.booking_url && (
          <p id="booking-error" role="alert" className="font-body text-xs text-red-600">{fieldErrors.booking_url}</p>
        )}
        <p className="font-body text-xs text-charcoal/40">Customers will be sent here when they click &quot;Book Now&quot; or &quot;Request Quote&quot;.</p>
      </div>

      {/* Status (edit only) */}
      {defaultValues?.service_id && (
        <div className="space-y-1">
          <label htmlFor="status" className="block font-subhead text-sm font-semibold text-brand-black">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={defaultValues.status ?? "draft"}
            className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold"
          >
            <option value="draft">Draft — not publicly visible</option>
            <option value="active">Active — visible in marketplace</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-brand-black text-white font-subhead font-bold text-sm hover:bg-charcoal transition-colors disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
      >
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isPending ? "Saving…" : submitLabel}
      </button>
    </form>
  )
}
