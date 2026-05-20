"use client"

import { useActionState } from "react"
import { Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { updateListingContentAction } from "@/lib/actions/dashboard/updateListingContent"

interface Props {
  listingId: string
  phone: string | null
  email: string | null
  websiteUrl: string | null
  addressLine1: string | null
  addressLine2: string | null
  state: string | null
  zip: string | null
}

function Field({ id, label, name, defaultValue, type = "text", placeholder }: {
  id: string; label: string; name: string; defaultValue?: string | null
  type?: string; placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-subhead text-xs font-semibold text-charcoal/70 mb-1">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
      />
    </div>
  )
}

export function ContactSection({ listingId, phone, email, websiteUrl, addressLine1, addressLine2, state, zip }: Props) {
  const [formState, formAction, isPending] = useActionState(updateListingContentAction, null)

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Contact & location</h2>
      </div>
      <form action={formAction} className="px-5 py-4 space-y-4">
        <input type="hidden" name="listing_id" value={listingId} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field id="c-phone" label="Phone" name="phone" defaultValue={phone} type="tel" placeholder="+1 (404) 555-0100" />
          <Field id="c-email" label="Email" name="email" defaultValue={email} type="email" placeholder="hello@yoursite.com" />
        </div>
        <Field id="c-website" label="Website URL" name="website_url" defaultValue={websiteUrl} placeholder="https://yoursite.com" />
        <Field id="c-addr1" label="Street address" name="address_line_1" defaultValue={addressLine1} placeholder="123 Auburn Ave" />
        <Field id="c-addr2" label="Apt / Suite" name="address_line_2" defaultValue={addressLine2} placeholder="Suite 200" />
        <div className="grid grid-cols-2 gap-4">
          <Field id="c-state" label="State" name="state" defaultValue={state} placeholder="GA" />
          <Field id="c-zip" label="ZIP code" name="zip" defaultValue={zip} placeholder="30312" />
        </div>

        {formState && "error" in formState && (
          <div role="alert" className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
            <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-red-700">{formState.error}</p>
          </div>
        )}
        {formState && "success" in formState && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
            <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-green-700">Saved.</p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button type="submit" disabled={isPending}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  )
}
