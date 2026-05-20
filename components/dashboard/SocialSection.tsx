'use client'

import { useActionState } from 'react'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { updateListingContentAction } from '@/lib/actions/dashboard/updateListingContent'

interface Props {
  listingId: string
  socialInstagram: string | null
  socialFacebook: string | null
  socialLinkedin: string | null
  socialTiktok: string | null
  socialYoutube: string | null
  socialTwitter: string | null
}

const SOCIAL_FIELDS = [
  {
    id: 's-ig',
    name: 'social_instagram',
    label: 'Instagram',
    placeholder: 'https://instagram.com/yourbusiness',
  },
  {
    id: 's-fb',
    name: 'social_facebook',
    label: 'Facebook',
    placeholder: 'https://facebook.com/yourbusiness',
  },
  {
    id: 's-li',
    name: 'social_linkedin',
    label: 'LinkedIn',
    placeholder: 'https://linkedin.com/company/yourbusiness',
  },
  {
    id: 's-tt',
    name: 'social_tiktok',
    label: 'TikTok',
    placeholder: 'https://tiktok.com/@yourbusiness',
  },
  {
    id: 's-yt',
    name: 'social_youtube',
    label: 'YouTube',
    placeholder: 'https://youtube.com/@yourbusiness',
  },
  {
    id: 's-tw',
    name: 'social_twitter',
    label: 'X / Twitter',
    placeholder: 'https://x.com/yourbusiness',
  },
] as const

export function SocialSection({
  listingId,
  socialInstagram,
  socialFacebook,
  socialLinkedin,
  socialTiktok,
  socialYoutube,
  socialTwitter,
}: Props) {
  const [state, formAction, isPending] = useActionState(updateListingContentAction, null)

  const values: Record<string, string | null> = {
    social_instagram: socialInstagram,
    social_facebook: socialFacebook,
    social_linkedin: socialLinkedin,
    social_tiktok: socialTiktok,
    social_youtube: socialYoutube,
    social_twitter: socialTwitter,
  }

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Social links</h2>
        <p className="font-body text-xs text-charcoal/50 mt-0.5">
          All URLs must start with https://
        </p>
      </div>
      <form action={formAction} className="px-5 py-4 space-y-3">
        <input type="hidden" name="listing_id" value={listingId} />

        {SOCIAL_FIELDS.map(({ id, name, label, placeholder }) => (
          <div key={name}>
            <label
              htmlFor={id}
              className="block font-subhead text-xs font-semibold text-charcoal/70 mb-1"
            >
              {label}
            </label>
            <input
              id={id}
              name={name}
              type="url"
              defaultValue={values[name] ?? ''}
              placeholder={placeholder}
              className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
            />
          </div>
        ))}

        {state && 'error' in state && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2"
          >
            <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-red-700">{state.error}</p>
          </div>
        )}
        {state && 'success' in state && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
            <CheckCircle className="size-4 text-green-600 shrink-0" aria-hidden="true" />
            <p className="font-body text-sm text-green-700">Saved.</p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
