import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { requireAdmin } from '@/lib/admin/guard'
import { createServiceClient } from '@/lib/supabase/server'
import { EntityEditForm } from './_components/EntityEditForm'

export const metadata: Metadata = { title: 'Edit Listing' }

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminEntityEditPage({ params }: Props) {
  await requireAdmin()
  const { id } = await params
  const serviceClient = createServiceClient()

  const { data: listing } = await serviceClient
    .from('listings')
    .select('id, name, tagline, status, listing_details_business(description, phone, email, website_url, address_line_1, address_line_2, state, zip, social_instagram, social_facebook, social_twitter, social_tiktok, social_linkedin, social_youtube)')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) notFound()

  const details = listing.listing_details_business as {
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
  } | null

  return (
    <div className="max-w-[800px] space-y-8">
      <div>
        <Link
          href={`/admin/entities/${id}`}
          className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal/50 hover:text-amber-gold mb-4 transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to listing
        </Link>
        <h1 className="font-headline text-2xl text-brand-black">Edit listing</h1>
        <p className="font-subhead text-sm text-charcoal/60 mt-0.5">{listing.name}</p>
      </div>

      <EntityEditForm
        listingId={listing.id}
        name={listing.name}
        tagline={listing.tagline}
        details={details}
      />
    </div>
  )
}
