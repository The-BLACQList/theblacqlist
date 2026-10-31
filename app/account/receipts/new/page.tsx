import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { ReceiptSubmissionForm } from '@/components/spend/ReceiptSubmissionForm'
import type { ReceiptFormDefaults } from '@/components/spend/ReceiptSubmissionForm'
import { NON_SHOPPABLE_ENTITY_TYPES, parseListingParam } from '@/lib/spend/receipt-prefill'

export const metadata: Metadata = { title: 'Add a Receipt' }

interface PrefillRow {
  id: string
  name: string
  cities: { name: string } | null
}

/**
 * The business behind `?listing=`, when it is one a receipt can be for: a
 * published listing that isn't an event or a job. Anything else, including a
 * failed read, prefills nothing and the shopper types the name as usual.
 */
async function loadPrefill(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string | null
): Promise<ReceiptFormDefaults['listing']> {
  if (!listingId) return null
  const { data, error } = await supabase
    .from('listings')
    .select('id, name, cities!listings_city_id_fkey(name)')
    .eq('id', listingId)
    .eq('status', 'published')
    .is('deleted_at', null)
    .not('entity_type', 'in', `(${NON_SHOPPABLE_ENTITY_TYPES.join(',')})`)
    .maybeSingle()
  if (error || !data) return null
  const row = data as unknown as PrefillRow
  return { id: row.id, name: row.name, cityName: row.cities?.name ?? null }
}

export default async function NewReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ listing?: string | string[] }>
}) {
  const listingId = parseListingParam((await searchParams).listing)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    const next = listingId ? `/account/receipts/new?listing=${listingId}` : '/account/receipts/new'
    redirect(`/sign-in?next=${encodeURIComponent(next)}`)
  }

  const prefillListing = await loadPrefill(supabase, listingId)

  return (
    <main className="min-h-screen bg-pale-lavender pt-16 pb-12 px-4">
      <div className="max-w-[560px] mx-auto space-y-6">
        <div>
          <Link
            href="/account/receipts"
            className="inline-flex items-center gap-1.5 font-subhead text-xs font-semibold text-charcoal-soft hover:text-amber mb-4 transition-colors"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            My receipts
          </Link>
          <h1 className="font-headline text-2xl text-brand-black">Add a receipt</h1>
          <p className="font-subhead text-sm text-charcoal-soft mt-0.5">
            Record a purchase at a business on the list to add your spend to The Collective.
          </p>
        </div>

        <div className="rounded-xl bg-white border border-charcoal/10 p-6">
          <ReceiptSubmissionForm prefillListing={prefillListing} />
        </div>
      </div>
    </main>
  )
}
