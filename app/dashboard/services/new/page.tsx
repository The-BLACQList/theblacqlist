import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { requireOwner } from '@/lib/dashboard/guard'
import { createClient } from '@/lib/supabase/server'
import { ServiceForm } from '@/components/marketplace/ServiceForm'
import { NoListingsNotice } from '@/components/dashboard/NoListingsNotice'
import { AllowanceNotice } from '@/components/marketplace/AllowanceNotice'
import { createServiceAction } from '@/lib/actions/marketplace/createService'
import { marketplaceAllowances } from '@/lib/marketplace/entitlements'

export const metadata: Metadata = { title: 'New Service | Dashboard' }

export default async function NewServicePage() {
  const owner = await requireOwner()
  const supabase = await createClient()

  // `tier` rides along because the marketplace allowance is per listing.
  const { data: listings } = await supabase
    .from('listings')
    .select('id, name, tier')
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  const owned = listings ?? []
  const allowances = await marketplaceAllowances(
    owned.map((l) => ({ id: l.id, tier: l.tier }))
  )
  const names = Object.fromEntries(owned.map((l) => [l.id, l.name]))

  // Services draw on the same allowance as products — one combined counter.
  const eligibleIds = new Set(allowances.filter((a) => a.canAddMore).map((a) => a.listingId))
  const eligible = owned
    .filter((l) => eligibleIds.has(l.id))
    .map((l) => ({ id: l.id, name: l.name }))

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

      {owned.length === 0 ? (
        <NoListingsNotice kind="service" />
      ) : (
        <>
          <AllowanceNotice allowances={allowances} names={names} kind="service" />
          {eligible.length > 0 && (
            <div className="rounded-xl border border-charcoal/10 bg-white p-6">
              <ServiceForm
                action={createServiceAction}
                listings={eligible}
                submitLabel="Create service"
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
