'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { type CreateProductState } from '@/lib/actions/marketplace/createProduct'
import { VALID_SHIPPING_OPTIONS } from '@/lib/constants/marketplace'
import { type UpdateProductState } from '@/lib/actions/marketplace/updateProduct'

interface ListingOption {
  id: string
  name: string
}

interface ProductFormProps {
  action: (
    prev: CreateProductState | UpdateProductState | null,
    formData: FormData
  ) => Promise<CreateProductState | UpdateProductState>
  listings: ListingOption[]
  defaultListingId?: string
  defaultValues?: {
    product_id?: string
    name?: string
    description?: string
    price_dollars?: string
    compare_price_dollars?: string
    price_display_text?: string
    cover_image_url?: string
    category_id?: string
    tags?: string
    shipping_options?: string
    return_policy_note?: string
    external_purchase_url?: string
    status?: string
  }
  submitLabel?: string
}

export function ProductForm({
  action,
  listings,
  defaultListingId,
  defaultValues,
  submitLabel = 'Save product',
}: ProductFormProps) {
  const router = useRouter()
  const [_state, formAction, isPending] = useActionState(
    action as Parameters<typeof useActionState>[0],
    null
  )
  const state = _state as CreateProductState | UpdateProductState

  useEffect(() => {
    if (state && 'success' in state && state.success) {
      if ('globalSlug' in state) {
        // Carry the status through so the list page can say plainly whether the
        // product is live or sitting as a draft — an owner should never have to
        // guess why a product they just made is not on the site.
        router.push(`/dashboard/products?created=${state.status}`)
      } else {
        router.push(`/dashboard/products?updated=true`)
      }
    }
  }, [state, router])

  const fieldErrors: Partial<Record<string, string>> =
    state && 'fieldErrors' in state && state.fieldErrors ? state.fieldErrors : {}

  return (
    <form action={formAction} className="space-y-5 max-w-xl">
      {/* Hidden product_id for updates */}
      {defaultValues?.product_id && (
        <input type="hidden" name="product_id" value={defaultValues.product_id} />
      )}

      {/* Error banner */}
      {state && 'error' in state && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="font-subhead text-sm text-red-700">{state.error}</p>
        </div>
      )}

      {/* Listing selector */}
      <div className="space-y-1">
        <label
          htmlFor="listing_id"
          className="block font-subhead text-sm font-semibold text-brand-black"
        >
          Listing{' '}
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
        </label>
        <select
          id="listing_id"
          name="listing_id"
          required
          defaultValue={defaultListingId ?? ''}
          className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold"
          aria-describedby={fieldErrors.listing_id ? 'listing-error' : undefined}
        >
          <option value="">Select a listing</option>
          {listings.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        {fieldErrors.listing_id && (
          <p id="listing-error" role="alert" className="font-body text-xs text-red-600">
            {fieldErrors.listing_id}
          </p>
        )}
      </div>

      {/* Name */}
      <div className="space-y-1">
        <label htmlFor="name" className="block font-subhead text-sm font-semibold text-brand-black">
          Product name{' '}
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={200}
          defaultValue={defaultValues?.name ?? ''}
          placeholder="e.g. Handmade Candle Set"
          className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold"
          aria-describedby={fieldErrors.name ? 'name-error' : undefined}
        />
        {fieldErrors.name && (
          <p id="name-error" role="alert" className="font-body text-xs text-red-600">
            {fieldErrors.name}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label
          htmlFor="description"
          className="block font-subhead text-sm font-semibold text-brand-black"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={2000}
          defaultValue={defaultValues?.description ?? ''}
          placeholder="Describe your product. Materials, dimensions, use cases..."
          className="w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold resize-none"
        />
      </div>

      {/* Pricing */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label
            htmlFor="price_cents"
            className="block font-subhead text-sm font-semibold text-brand-black"
          >
            Price ($)
          </label>
          <input
            id="price_cents"
            name="price_cents"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={defaultValues?.price_dollars ?? ''}
            placeholder="0.00"
            className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold"
            aria-describedby={fieldErrors.price_cents ? 'price-error' : undefined}
          />
          {fieldErrors.price_cents && (
            <p id="price-error" role="alert" className="font-body text-xs text-red-600">
              {fieldErrors.price_cents}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <label
            htmlFor="compare_at_price_cents"
            className="block font-subhead text-sm font-semibold text-brand-black"
          >
            Compare-at ($)
          </label>
          <input
            id="compare_at_price_cents"
            name="compare_at_price_cents"
            type="number"
            min="0.01"
            step="0.01"
            defaultValue={defaultValues?.compare_price_dollars ?? ''}
            placeholder="Original price"
            className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold"
            aria-describedby={fieldErrors.compare_at_price_cents ? 'compare-error' : undefined}
          />
          {fieldErrors.compare_at_price_cents && (
            <p id="compare-error" role="alert" className="font-body text-xs text-red-600">
              {fieldErrors.compare_at_price_cents}
            </p>
          )}
        </div>
      </div>

      {/* Price display override */}
      <div className="space-y-1">
        <label
          htmlFor="price_display_text"
          className="block font-subhead text-sm font-semibold text-brand-black"
        >
          Price display text{' '}
          <span className="font-normal text-charcoal-faint">(optional override)</span>
        </label>
        <input
          id="price_display_text"
          name="price_display_text"
          type="text"
          maxLength={80}
          defaultValue={defaultValues?.price_display_text ?? ''}
          placeholder='e.g. "Starting at $25" or "$25–$100"'
          className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold"
        />
      </div>

      {/* Cover image URL */}
      <div className="space-y-1">
        <label
          htmlFor="cover_image_url"
          className="block font-subhead text-sm font-semibold text-brand-black"
        >
          Cover image URL
        </label>
        <input
          id="cover_image_url"
          name="cover_image_url"
          type="url"
          defaultValue={defaultValues?.cover_image_url ?? ''}
          placeholder="https://..."
          className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold"
          aria-describedby={fieldErrors.cover_image_url ? 'image-error' : undefined}
        />
        {fieldErrors.cover_image_url && (
          <p id="image-error" role="alert" className="font-body text-xs text-red-600">
            {fieldErrors.cover_image_url}
          </p>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-1">
        <label htmlFor="tags" className="block font-subhead text-sm font-semibold text-brand-black">
          Tags <span className="font-normal text-charcoal-faint">(comma-separated)</span>
        </label>
        <input
          id="tags"
          name="tags"
          type="text"
          defaultValue={defaultValues?.tags ?? ''}
          placeholder="e.g. candles, handmade, gifts"
          className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold"
        />
      </div>

      {/* Shipping options */}
      <fieldset className="space-y-2">
        <legend className="font-subhead text-sm font-semibold text-brand-black">
          Fulfillment{' '}
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
        </legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {VALID_SHIPPING_OPTIONS.map((opt) => {
            const labels: Record<string, string> = {
              shipping: 'Ships nationwide',
              pickup: 'Pickup only',
              both: 'Ships + pickup',
              digital: 'Digital delivery',
              none: 'No shipping',
            }
            return (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="shipping_options"
                  value={opt}
                  defaultChecked={(defaultValues?.shipping_options ?? 'shipping') === opt}
                  className="accent-amber-gold"
                />
                <span className="font-body text-sm text-charcoal">{labels[opt]}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {/* Return policy note */}
      <div className="space-y-1">
        <label
          htmlFor="return_policy_note"
          className="block font-subhead text-sm font-semibold text-brand-black"
        >
          Return policy note
        </label>
        <input
          id="return_policy_note"
          name="return_policy_note"
          type="text"
          maxLength={300}
          defaultValue={defaultValues?.return_policy_note ?? ''}
          placeholder="e.g. All sales final. No returns on digital products."
          className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold"
        />
      </div>

      {/* External purchase URL */}
      <div className="space-y-1">
        <label
          htmlFor="external_purchase_url"
          className="block font-subhead text-sm font-semibold text-brand-black"
        >
          Purchase URL <span className="font-normal text-charcoal-faint">(where to buy)</span>
        </label>
        <input
          id="external_purchase_url"
          name="external_purchase_url"
          type="url"
          defaultValue={defaultValues?.external_purchase_url ?? ''}
          placeholder="https://yourstore.com/product"
          className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold"
          aria-describedby={fieldErrors.external_purchase_url ? 'purchase-url-error' : undefined}
        />
        {fieldErrors.external_purchase_url && (
          <p id="purchase-url-error" role="alert" className="font-body text-xs text-red-600">
            {fieldErrors.external_purchase_url}
          </p>
        )}
        <p className="font-body text-xs text-charcoal-faint">
          Customers will be taken to this URL when they click &quot;Shop Now&quot;.
        </p>
      </div>

      {/*
        Status renders on create as well as edit. It used to be edit-only, which
        meant a first product was silently inserted as a draft — invisible in the
        marketplace, with nothing on screen explaining why. Creating defaults to
        Active so the ordinary path publishes, but the choice stays visible and
        explicit rather than being made for the owner.
      */}
      <div className="space-y-1">
        <label htmlFor="status" className="block font-subhead text-sm font-semibold text-brand-black">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={defaultValues?.status ?? (defaultValues?.product_id ? 'draft' : 'active')}
          className="w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black focus:outline-none focus:ring-2 focus:ring-amber-gold"
          aria-describedby={fieldErrors.status ? 'status-error' : 'status-hint'}
        >
          <option value="active">Active: visible in marketplace</option>
          <option value="draft">Draft: not publicly visible</option>
          {defaultValues?.product_id && <option value="archived">Archived</option>}
        </select>
        {fieldErrors.status ? (
          <p id="status-error" role="alert" className="font-body text-xs text-red-600">
            {fieldErrors.status}
          </p>
        ) : (
          <p id="status-hint" className="font-body text-xs text-charcoal-faint">
            Active products appear on your storefront and in the marketplace right away. Drafts stay
            private until you change this to Active.
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-brand-black text-white font-subhead font-bold text-sm hover:bg-charcoal transition-colors disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px]"
      >
        {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isPending ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
