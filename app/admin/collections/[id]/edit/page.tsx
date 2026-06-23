import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowLeft, X } from 'lucide-react'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import {
  updateCollectionAction,
  removeCollectionItemAction,
  addCollectionItemAction,
  updateCollectionItemAction,
  addCollectionSectionAction,
  updateCollectionSectionAction,
  removeCollectionSectionAction,
} from '@/lib/actions/editorial/collections'
import { CollectionAdminForm } from '@/components/editorial/AdminEditorialForm'

export const metadata: Metadata = { title: 'Edit Collection' }

interface Props {
  params: Promise<{ id: string }>
}

// Server actions used directly in <form action> need the (formData) => Promise<void> shape.
function formAction<S>(action: (prev: S, fd: FormData) => Promise<S>) {
  return action.bind(null, null as S) as unknown as (formData: FormData) => Promise<void>
}

const inputCls =
  'w-full h-9 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/60'
const textareaCls =
  'w-full px-3 py-2 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/60 resize-y'

export default async function EditCollectionPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params
  const serviceClient = createServiceClient()

  const { data: collection } = await serviceClient
    .from('collections')
    .select('id, title, slug, subtitle, description, body, cover_image_path, is_active')
    .eq('id', id)
    .single()

  if (!collection) notFound()

  const { data: items } = await serviceClient
    .from('collection_items')
    .select('id, display_order, headline, blurb, listings(id, name, slug, tagline)')
    .eq('collection_id', id)
    .order('display_order', { ascending: true })

  const listings = (items ?? [])
    .map((item) => ({
      itemId: item.id,
      display_order: item.display_order,
      headline: item.headline,
      blurb: item.blurb,
      ...((item.listings as {
        id: string
        name: string
        slug: string
        tagline: string | null
      } | null) ?? { id: '', name: '', slug: '', tagline: null }),
    }))
    .filter((l) => l.id)

  const { data: sections } = await serviceClient
    .from('collection_sections')
    .select('id, heading, body, display_order')
    .eq('collection_id', id)
    .order('display_order', { ascending: true })

  return (
    <div className="max-w-[800px] space-y-8">
      <div>
        <Link
          href="/admin/collections"
          className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal-soft hover:text-amber mb-4 transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Collections
        </Link>
        <h1 className="font-headline text-2xl text-brand-black">Edit collection</h1>
        <p className="font-subhead text-sm text-charcoal-soft mt-0.5">{collection.title}</p>
      </div>

      {/* Collection details */}
      <div className="rounded-xl border border-charcoal/10 bg-white p-6">
        <h2 className="font-headline text-base text-brand-black mb-4">Details</h2>
        <CollectionAdminForm
          action={updateCollectionAction}
          defaultValues={collection}
          redirectOnSuccess="/admin/collections"
        />
      </div>

      {/* Listings in collection — with editorial blurbs */}
      <div className="rounded-xl border border-charcoal/10 bg-white p-6 space-y-5">
        <div>
          <h2 className="font-headline text-base text-brand-black">Businesses</h2>
          <p className="font-subhead text-xs text-charcoal-soft mt-0.5">
            {listings.length} {listings.length === 1 ? 'business' : 'businesses'} · add a blurb to
            give each its editorial context
          </p>
        </div>

        {listings.length > 0 && (
          <div className="space-y-4">
            {listings.map((listing) => (
              <div key={listing.itemId} className="rounded-lg border border-charcoal/10 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="font-subhead text-sm font-semibold text-brand-black truncate">
                      {listing.name}
                    </p>
                    {listing.tagline && (
                      <p className="font-body text-xs text-charcoal-soft truncate mt-0.5">
                        {listing.tagline}
                      </p>
                    )}
                  </div>
                  <form action={formAction(removeCollectionItemAction)}>
                    <input type="hidden" name="item_id" value={listing.itemId} />
                    <button
                      type="submit"
                      aria-label={`Remove ${listing.name} from collection`}
                      className="flex items-center justify-center size-8 rounded-lg text-charcoal-faint hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </form>
                </div>

                <form action={formAction(updateCollectionItemAction)} className="space-y-2">
                  <input type="hidden" name="item_id" value={listing.itemId} />
                  <div className="flex gap-2">
                    <input
                      name="headline"
                      type="text"
                      maxLength={40}
                      defaultValue={listing.headline ?? ''}
                      placeholder="Pill (optional), e.g. Editor's pick"
                      className={`${inputCls} max-w-[220px]`}
                    />
                    <input
                      name="display_order"
                      type="number"
                      defaultValue={listing.display_order}
                      aria-label="Display order"
                      className={`${inputCls} w-20`}
                    />
                  </div>
                  <textarea
                    name="blurb"
                    rows={2}
                    defaultValue={listing.blurb ?? ''}
                    placeholder="Why this business is in the collection…"
                    className={textareaCls}
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="h-8 px-4 rounded-lg bg-charcoal/10 hover:bg-charcoal/20 text-brand-black font-subhead font-bold text-xs transition-colors"
                    >
                      Save blurb
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}

        {/* Add listing by ID */}
        <form action={formAction(addCollectionItemAction)} className="flex gap-2 pt-2">
          <input type="hidden" name="collection_id" value={id} />
          <input
            name="listing_id"
            type="text"
            placeholder="Listing UUID"
            required
            className="flex-1 h-9 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal-faint focus:outline-none focus:ring-2 focus:ring-amber-gold/60"
          />
          <button
            type="submit"
            className="h-9 px-4 rounded-lg bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-xs transition-colors shrink-0"
          >
            Add
          </button>
        </form>
        <p className="font-body text-xs text-charcoal-faint">
          Paste a listing UUID from the Entities admin to add it to this collection.
        </p>
      </div>

      {/* Editorial sections */}
      <div className="rounded-xl border border-charcoal/10 bg-white p-6 space-y-5">
        <div>
          <h2 className="font-headline text-base text-brand-black">Editorial sections</h2>
          <p className="font-subhead text-xs text-charcoal-soft mt-0.5">
            Narrative blocks shown below the business list (e.g. &ldquo;How we chose these&rdquo;).
          </p>
        </div>

        {(sections ?? []).length > 0 && (
          <div className="space-y-4">
            {(sections ?? []).map((section) => (
              <div key={section.id} className="rounded-lg border border-charcoal/10 p-4">
                <form action={formAction(updateCollectionSectionAction)} className="space-y-2">
                  <input type="hidden" name="section_id" value={section.id} />
                  <div className="flex gap-2">
                    <input
                      name="heading"
                      type="text"
                      required
                      defaultValue={section.heading}
                      placeholder="Section heading"
                      className={`${inputCls} flex-1`}
                    />
                    <input
                      name="display_order"
                      type="number"
                      defaultValue={section.display_order}
                      aria-label="Display order"
                      className={`${inputCls} w-20`}
                    />
                  </div>
                  <textarea
                    name="body"
                    rows={4}
                    defaultValue={section.body ?? ''}
                    placeholder="Section text. Use ## for headings, > for quotes…"
                    className={textareaCls}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="submit"
                      className="h-8 px-4 rounded-lg bg-charcoal/10 hover:bg-charcoal/20 text-brand-black font-subhead font-bold text-xs transition-colors"
                    >
                      Save section
                    </button>
                  </div>
                </form>
                <form action={formAction(removeCollectionSectionAction)} className="flex justify-end mt-2">
                  <input type="hidden" name="section_id" value={section.id} />
                  <button
                    type="submit"
                    className="font-subhead text-xs font-semibold text-red-500 hover:underline"
                  >
                    Remove section
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        {/* Add section */}
        <form action={formAction(addCollectionSectionAction)} className="space-y-2 pt-2 border-t border-charcoal/10">
          <input type="hidden" name="collection_id" value={id} />
          <p className="font-subhead text-xs font-semibold text-brand-black pt-2">Add a section</p>
          <input
            name="heading"
            type="text"
            required
            placeholder="Section heading"
            className={inputCls}
          />
          <textarea name="body" rows={3} placeholder="Section text…" className={textareaCls} />
          <div className="flex justify-end">
            <button
              type="submit"
              className="h-9 px-4 rounded-lg bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-xs transition-colors"
            >
              Add section
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
