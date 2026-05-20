import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireOwner } from '@/lib/dashboard/guard'
import { MediaGrid } from '@/components/dashboard/MediaGrid'

interface Props {
  params: Promise<{ entityId: string }>
}

export default async function MediaPage({ params }: Props) {
  const { entityId } = await params
  const owner = await requireOwner()
  const supabase = await createClient()

  const { data: listing } = await supabase
    .from('listings')
    .select('id, name')
    .eq('id', entityId)
    .eq('owner_user_id', owner.user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!listing) notFound()

  const { data: media } = await supabase
    .from('media_attachments')
    .select('id, file_path, file_type, alt_text, display_order')
    .eq('entity_id', entityId)
    .eq('entity_type', 'listing')
    .order('display_order', { ascending: true })

  const supabaseStorageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL + '/storage/v1/object/public'

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-headline text-2xl text-brand-black">Media</h1>
        <p className="font-body text-sm text-charcoal/60 mt-0.5">{listing.name}</p>
      </div>

      <MediaGrid
        media={media ?? []}
        supabaseStorageUrl={supabaseStorageUrl}
        listingId={listing.id}
      />
    </div>
  )
}
