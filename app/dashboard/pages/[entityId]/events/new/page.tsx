import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { isFeatureEnabled } from '@/lib/env'
import { canAccess } from '@/lib/stripe/features'
import { eventQuotaFor } from '@/lib/stripe/jobPostings'
import { SubmitEventForm } from '@/components/listings/SubmitEventForm'

export const metadata: Metadata = { title: 'New Event | Dashboard' }

// Flags are read per request (see lib/env.ts), so this must not prerender.
export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ entityId: string }>
}

// Ticket 106. The /add-event form, started from a page's Events tab so the
// event is tied to that page as its host. createListing checks the plan and
// the host again; this page only spares the owner a form they cannot use.
export default async function NewPageEventPage({ params }: Props) {
  if (!isFeatureEnabled('postingSubmissions')) notFound()

  const { entityId } = await params
  const owner = await requireOwner()
  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('id, name, entity_type')
    .eq('id', entityId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) notFound()
  const eventsTab = `/dashboard/pages/${listing.id}/events`
  if (listing.entity_type === 'event' || listing.entity_type === 'job') {
    redirect(`/dashboard/pages/${listing.id}/edit`)
  }

  if (isFeatureEnabled('paidPostings')) {
    const quota = await eventQuotaFor(supabase, owner.user.id)
    // The Events tab explains a failed read or a plan without events.
    if (!quota.ok || !canAccess(quota.value.tier, 'events')) redirect(eventsTab)
  }

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, parent_id')
    .eq('is_active', true)
    .order('display_order')

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href={eventsTab}
          className="inline-flex items-center gap-1.5 font-subhead text-xs text-charcoal-faint hover:text-charcoal mb-3"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          Back to events
        </Link>
        <h1 className="font-headline text-2xl text-brand-black">New event</h1>
        <p className="font-body text-sm text-charcoal-soft mt-0.5">{listing.name}</p>
      </div>

      <SubmitEventForm
        categories={categories ?? []}
        host={{ id: listing.id, name: listing.name }}
      />
    </div>
  )
}
