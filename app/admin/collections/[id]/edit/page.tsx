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
} from '@/lib/actions/editorial/collections'
import { CollectionAdminForm } from '@/components/editorial/AdminEditorialForm'

export const metadata: Metadata = { title: 'Edit Collection' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditCollectionPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params
  const serviceClient = createServiceClient()

  const { data: collection } = await serviceClient
    .from('collections')
    .select('id, title, slug, description, is_active')
    .eq('id', id)
    .single()

  if (!collection) notFound()

  const { data: items } = await serviceClient
    .from('collection_items')
    .select('id, display_order, listings(id, name, slug, tagline)')
    .eq('collection_id', id)
    .order('display_order', { ascending: true })

  const listings = (items ?? [])
    .map((item) => ({
      itemId: item.id,
      ...((item.listings as {
        id: string
        name: string
        slug: string
        tagline: string | null
      } | null) ?? { id: '', name: '', slug: '', tagline: null }),
    }))
    .filter((l) => l.id)

  return (
    <div className="max-w-[800px] space-y-8">
      <div>
        <Link
          href="/admin/collections"
          className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal/50 hover:text-amber-gold mb-4 transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Collections
        </Link>
        <h1 className="font-headline text-2xl text-brand-black">Edit collection</h1>
        <p className="font-subhead text-sm text-charcoal/60 mt-0.5">{collection.title}</p>
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

      {/* Listings in collection */}
      <div className="rounded-xl border border-charcoal/10 bg-white p-6 space-y-5">
        <div>
          <h2 className="font-headline text-base text-brand-black">Listings</h2>
          <p className="font-subhead text-xs text-charcoal/50 mt-0.5">
            {listings.length} {listings.length === 1 ? 'listing' : 'listings'} in this collection
          </p>
        </div>

        {listings.length > 0 && (
          <div className="divide-y divide-charcoal/5">
            {listings.map((listing) => (
              <div key={listing.itemId} className="py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-subhead text-sm font-semibold text-brand-black truncate">
                    {listing.name}
                  </p>
                  {listing.tagline && (
                    <p className="font-body text-xs text-charcoal/50 truncate mt-0.5">
                      {listing.tagline}
                    </p>
                  )}
                </div>
                <form
                  action={
                    removeCollectionItemAction.bind(null, null) as unknown as (
                      formData: FormData
                    ) => Promise<void>
                  }
                >
                  <input type="hidden" name="item_id" value={listing.itemId} />
                  <button
                    type="submit"
                    aria-label={`Remove ${listing.name} from collection`}
                    className="flex items-center justify-center size-8 rounded-lg text-charcoal/40 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        {/* Add listing by ID */}
        <form
          action={
            addCollectionItemAction.bind(null, null) as unknown as (
              formData: FormData
            ) => Promise<void>
          }
          className="flex gap-2 pt-2"
        >
          <input type="hidden" name="collection_id" value={id} />
          <input
            name="listing_id"
            type="text"
            placeholder="Listing UUID"
            required
            className="flex-1 h-9 px-3 rounded-lg border border-charcoal/20 bg-white font-body text-sm text-brand-black placeholder:text-charcoal/40 focus:outline-none focus:ring-2 focus:ring-amber-gold/60"
          />
          <button
            type="submit"
            className="h-9 px-4 rounded-lg bg-amber-gold hover:bg-light-gold text-brand-black font-subhead font-bold text-xs transition-colors shrink-0"
          >
            Add
          </button>
        </form>
        <p className="font-body text-xs text-charcoal/40">
          Paste a listing UUID from the Entities admin to add it to this collection.
        </p>
      </div>
    </div>
  )
}
