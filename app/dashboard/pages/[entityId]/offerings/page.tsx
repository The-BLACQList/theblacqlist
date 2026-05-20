import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { requireOwner } from "@/lib/dashboard/guard"
import { OfferingsList } from "@/components/dashboard/OfferingsList"
import { AddOfferingForm } from "@/components/dashboard/AddOfferingForm"

interface Props {
  params: Promise<{ entityId: string }>
}

export default async function OfferingsPage({ params }: Props) {
  const { entityId } = await params
  const owner = await requireOwner()
  const supabase = await createClient()

  const { data: listing } = await supabase
    .from("listings")
    .select("id, name")
    .eq("id", entityId)
    .eq("owner_user_id", owner.user.id)
    .is("deleted_at", null)
    .maybeSingle()

  if (!listing) notFound()

  const { data: services } = await supabase
    .from("services")
    .select("id, name, description, price_display, is_featured, display_order")
    .eq("listing_id", entityId)
    .order("display_order", { ascending: true })

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Offerings</h1>
        <p className="font-body text-sm text-charcoal/60 mt-0.5">{listing.name}</p>
      </div>

      <div className="rounded-xl border border-charcoal/10 bg-white">
        <div className="px-5 py-4 border-b border-charcoal/8">
          <h2 className="font-headline text-base text-brand-black">Services & offerings</h2>
          <p className="font-body text-xs text-charcoal/50 mt-0.5">
            Add what your business offers — services, products, or classes.
          </p>
        </div>
        <div className="px-5 py-4">
          <OfferingsList services={services ?? []} />
        </div>
      </div>

      <AddOfferingForm listingId={listing.id} />
    </div>
  )
}
