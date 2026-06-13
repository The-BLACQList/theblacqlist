'use client'

import { useActionState } from 'react'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { updateEntityContentAction } from '@/lib/actions/admin/updateEntityContent'

interface EntityDetails {
  description: string | null
  phone: string | null
  email: string | null
  website_url: string | null
  address_line_1: string | null
  address_line_2: string | null
  state: string | null
  zip: string | null
  social_instagram: string | null
  social_facebook: string | null
  social_twitter: string | null
  social_tiktok: string | null
  social_linkedin: string | null
  social_youtube: string | null
}

interface Props {
  listingId: string
  name: string
  tagline: string | null
  details: EntityDetails | null
}

const inputCls =
  'w-full h-10 rounded-lg border border-charcoal/20 bg-white px-3 font-body text-sm text-brand-black placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black'

const labelCls = 'block font-subhead text-xs font-semibold text-charcoal/60 mb-1'

export function EntityEditForm({ listingId, name, tagline, details }: Props) {
  const [state, action, isPending] = useActionState(updateEntityContentAction, null)

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="listing_id" value={listingId} />

      {/* Status feedback */}
      {state && 'success' in state && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3">
          <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
          <p className="font-subhead text-sm text-green-700">Changes saved.</p>
        </div>
      )}
      {state && 'error' in state && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3" role="alert">
          <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
          <p className="font-body text-sm text-red-700">{state.error}</p>
        </div>
      )}

      {/* Core listing fields */}
      <div className="rounded-xl border border-charcoal/10 bg-white p-5 space-y-4">
        <h2 className="font-headline text-base text-brand-black">Listing</h2>
        <div>
          <label htmlFor="name" className={labelCls}>Business name <span className="text-red-500">*</span></label>
          <input id="name" name="name" type="text" required maxLength={200} defaultValue={name} className={inputCls} />
        </div>
        <div>
          <label htmlFor="tagline" className={labelCls}>Tagline</label>
          <input id="tagline" name="tagline" type="text" maxLength={140} defaultValue={tagline ?? ''} className={inputCls} />
        </div>
      </div>

      {/* Business details */}
      <div className="rounded-xl border border-charcoal/10 bg-white p-5 space-y-4">
        <h2 className="font-headline text-base text-brand-black">Business details</h2>
        <div>
          <label htmlFor="description" className={labelCls}>Description</label>
          <textarea
            id="description"
            name="description"
            rows={5}
            defaultValue={details?.description ?? ''}
            className="w-full rounded-lg border border-charcoal/20 bg-white px-3 py-2 font-body text-sm text-brand-black placeholder:text-charcoal/30 focus:outline-none focus:ring-2 focus:ring-brand-black/20 focus:border-brand-black resize-none"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className={labelCls}>Phone</label>
            <input id="phone" name="phone" type="tel" defaultValue={details?.phone ?? ''} className={inputCls} />
          </div>
          <div>
            <label htmlFor="email" className={labelCls}>Email</label>
            <input id="email" name="email" type="email" defaultValue={details?.email ?? ''} className={inputCls} />
          </div>
        </div>
        <div>
          <label htmlFor="website_url" className={labelCls}>Website URL</label>
          <input id="website_url" name="website_url" type="url" defaultValue={details?.website_url ?? ''} placeholder="https://" className={inputCls} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="address_line_1" className={labelCls}>Address line 1</label>
            <input id="address_line_1" name="address_line_1" type="text" defaultValue={details?.address_line_1 ?? ''} className={inputCls} />
          </div>
          <div>
            <label htmlFor="address_line_2" className={labelCls}>Address line 2</label>
            <input id="address_line_2" name="address_line_2" type="text" defaultValue={details?.address_line_2 ?? ''} className={inputCls} />
          </div>
          <div>
            <label htmlFor="state" className={labelCls}>State</label>
            <input id="state" name="state" type="text" maxLength={2} defaultValue={details?.state ?? ''} className={inputCls} />
          </div>
          <div>
            <label htmlFor="zip" className={labelCls}>ZIP code</label>
            <input id="zip" name="zip" type="text" maxLength={10} defaultValue={details?.zip ?? ''} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Social links */}
      <div className="rounded-xl border border-charcoal/10 bg-white p-5 space-y-4">
        <h2 className="font-headline text-base text-brand-black">Social links</h2>
        {(
          [
            ['social_instagram', 'Instagram', details?.social_instagram],
            ['social_facebook', 'Facebook', details?.social_facebook],
            ['social_twitter', 'X / Twitter', details?.social_twitter],
            ['social_tiktok', 'TikTok', details?.social_tiktok],
            ['social_linkedin', 'LinkedIn', details?.social_linkedin],
            ['social_youtube', 'YouTube', details?.social_youtube],
          ] as [string, string, string | null][]
        ).map(([name, label, val]) => (
          <div key={name}>
            <label htmlFor={name} className={labelCls}>{label}</label>
            <input id={name} name={name} type="url" defaultValue={val ?? ''} placeholder="https://" className={inputCls} />
          </div>
        ))}
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-full bg-brand-black text-white font-subhead text-sm font-bold hover:bg-charcoal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  )
}
