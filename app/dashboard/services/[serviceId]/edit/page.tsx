import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { requireOwner } from '@/lib/dashboard/guard'
import { createClient } from '@/lib/supabase/server'
import { ServiceForm } from '@/components/marketplace/ServiceForm'
import { updateServiceAction } from '@/lib/actions/marketplace/updateService'

interface Props {
  params: Promise<{ serviceId: string }>
}

export const metadata: Metadata = { title: 'Edit Service | Dashboard' }

export default async function EditServicePage({ params }: Props) {
  const { serviceId } = await params
  const owner = await requireOwner()
  const supabase = await createClient()

  const [{ data: listings }, { data: service }] = await Promise.all([
    supabase
      .from('listings')
      .select('id, name')
      .eq('owner_user_id', owner.user.id)
      .is('deleted_at', null)
      .order('name', { ascending: true }),
    supabase
      .from('marketplace_services')
      .select(
        'id, name, description, starting_price_cents, price_display_text, duration_text, delivery_mode, booking_url, cover_image_url, status, listing_id'
      )
      .eq('id', serviceId)
      .maybeSingle(),
  ])

  if (!service) notFound()

  const ownsListing = (listings ?? []).some((l) => l.id === service.listing_id)
  if (!ownsListing) notFound()

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/services"
          className="inline-flex items-center gap-1.5 font-subhead text-xs text-charcoal/40 hover:text-charcoal mb-3"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          Back to services
        </Link>
        <h1 className="font-headline text-2xl text-brand-black">Edit service</h1>
        <p className="font-body text-sm text-charcoal/60 mt-0.5">{service.name}</p>
      </div>

      <div className="rounded-xl border border-charcoal/10 bg-white p-6">
        <ServiceForm
          action={updateServiceAction}
          listings={listings ?? []}
          defaultListingId={service.listing_id}
          defaultValues={{
            service_id: service.id,
            name: service.name,
            description: service.description ?? '',
            starting_price_dollars: service.starting_price_cents
              ? String(service.starting_price_cents / 100)
              : '',
            price_display_text: service.price_display_text ?? '',
            duration_text: service.duration_text ?? '',
            delivery_mode: service.delivery_mode ?? 'in_person',
            booking_url: service.booking_url ?? '',
            cover_image_url: service.cover_image_url ?? '',
            status: service.status ?? 'draft',
          }}
          submitLabel="Save changes"
        />
      </div>
    </div>
  )
}
