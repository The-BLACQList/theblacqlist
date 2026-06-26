import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { requireOwner } from '@/lib/dashboard/guard'
import { createClient } from '@/lib/supabase/server'
import { ServiceForm } from '@/components/marketplace/ServiceForm'
import { createServiceAction } from '@/lib/actions/marketplace/createService'

export const metadata: Metadata = { title: 'New Service | Dashboard' }

export default async function NewServicePage() {
  const owner = await requireOwner()
  const supabase = await createClient()

  const { data: listings } = await supabase
    .from('listings')
    .select('id, name')
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/dashboard/services"
          className="inline-flex items-center gap-1.5 font-subhead text-xs text-charcoal-faint hover:text-charcoal mb-3"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          Back to services
        </Link>
        <h1 className="font-headline text-2xl text-brand-black">Add service</h1>
        <p className="font-body text-sm text-charcoal-soft mt-0.5">
          List a new service in the BLACQList Marketplace.
        </p>
      </div>

      <div className="rounded-xl border border-charcoal/10 bg-white p-6">
        <ServiceForm
          action={createServiceAction}
          listings={listings ?? []}
          submitLabel="Create service"
        />
      </div>
    </div>
  )
}
