'use client'

import { useActionState, useRef, useEffect } from 'react'
import { Loader2, Plus, AlertCircle, Trash2 } from 'lucide-react'
import { addListingLinkAction } from '@/lib/actions/dashboard/addListingLink'
import { deleteListingLinkAction } from '@/lib/actions/dashboard/deleteListingLink'
import { LINK_TYPES } from '@/lib/constants/listing'

interface LinkRow {
  id: string
  link_type: string
  url: string
  label: string | null
}

interface Props {
  listingId: string
  links: LinkRow[]
}

export const LINK_TYPE_LABELS: Record<string, string> = {
  website: 'Website',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  twitter: 'X / Twitter',
  booking: 'Booking',
  menu: 'Menu',
  order: 'Order',
  other: 'Other',
}

function DeleteLinkButton({ linkId }: { linkId: string }) {
  const [state, formAction, isPending] = useActionState(deleteListingLinkAction, null)
  return (
    <form action={formAction}>
      <input type="hidden" name="link_id" value={linkId} />
      <button
        type="submit"
        disabled={isPending}
        aria-label="Delete link"
        className="inline-flex items-center justify-center size-8 rounded-lg text-charcoal-faint hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="size-4" aria-hidden="true" />
        )}
      </button>
      {state && 'error' in state && (
        <p className="font-body text-xs text-red-600 mt-1">{state.error}</p>
      )}
    </form>
  )
}

export function LinksSection({ listingId, links }: Props) {
  const [state, formAction, isPending] = useActionState(addListingLinkAction, null)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state && 'success' in state) formRef.current?.reset()
  }, [state])

  return (
    <div className="rounded-xl border border-charcoal/10 bg-white">
      <div className="px-5 py-4 border-b border-charcoal/8">
        <h2 className="font-headline text-base text-brand-black">Links</h2>
        <p className="font-body text-xs text-charcoal-soft mt-0.5">
          Add booking, menu, order, or other links shown on your page. URLs must start with https://
        </p>
      </div>

      <div className="px-5 py-4 space-y-4">
        {links.length > 0 && (
          <ul className="space-y-2">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex items-center gap-3 rounded-lg border border-charcoal/8 bg-white px-4 py-2.5"
              >
                <span className="inline-flex shrink-0 items-center rounded-full bg-pale-lavender px-2 py-0.5 font-subhead text-[11px] font-semibold text-brand-black">
                  {LINK_TYPE_LABELS[link.link_type] ?? link.link_type}
                </span>
                <span className="flex-1 min-w-0 truncate font-body text-xs text-charcoal-soft">
                  {link.label ? `${link.label} · ` : ''}
                  {link.url}
                </span>
                <DeleteLinkButton linkId={link.id} />
              </li>
            ))}
          </ul>
        )}

        <form ref={formRef} action={formAction} className="space-y-3 border-t border-charcoal/8 pt-4">
          <input type="hidden" name="listing_id" value={listingId} />
          <div className="flex gap-2">
            <div>
              <label
                htmlFor="link-type"
                className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
              >
                Type
              </label>
              <select
                id="link-type"
                name="link_type"
                defaultValue="booking"
                className="h-10 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black px-2 focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
              >
                {LINK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {LINK_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label
                htmlFor="link-url"
                className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
              >
                URL
              </label>
              <input
                id="link-url"
                name="url"
                type="url"
                required
                placeholder="https://…"
                className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="link-label"
              className="block font-subhead text-xs font-semibold text-charcoal-soft mb-1"
            >
              Label <span className="font-normal text-charcoal-faint">(optional)</span>
            </label>
            <input
              id="link-label"
              name="label"
              type="text"
              placeholder="e.g. Book on Resy"
              className="w-full px-3 py-2 rounded-lg border border-charcoal/20 font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/40"
            />
          </div>

          {state && 'error' in state && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2"
            >
              <AlertCircle className="size-4 text-red-500 shrink-0" aria-hidden="true" />
              <p className="font-body text-sm text-red-700">{state.error}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-2 h-9 px-5 rounded-lg bg-amber-gold text-brand-black font-subhead font-bold text-sm hover:bg-light-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              {isPending ? 'Adding…' : 'Add link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
