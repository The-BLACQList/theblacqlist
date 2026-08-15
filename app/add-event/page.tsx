import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SubmitEventForm } from '@/components/listings/SubmitEventForm'

export const metadata = {
  title: 'Add an Event | The BLACQList',
  description: 'List a Black-owned or Black-centered event on The BLACQList.',
}

export default async function AddEventPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/add-event')

  const { data: categories } = await supabase
    .from('categories')
    .select('id, name, slug, parent_id')
    .eq('is_active', true)
    .order('display_order')

  return (
    <main className="min-h-screen bg-pale-lavender pt-16 pb-16 px-4">
      <div className="max-w-[680px] mx-auto py-10">
        <div className="mb-8">
          <p className="font-subhead text-xs font-semibold uppercase tracking-widest text-amber mb-2">
            Get Listed
          </p>
          <h1 className="font-headline text-3xl md:text-4xl text-brand-black mb-3">Add an event</h1>
          <p className="font-subhead text-sm text-charcoal leading-relaxed max-w-lg">
            Share a Black-owned or Black-centered event. Submissions are reviewed by our team before
            going live.
          </p>
        </div>

        <SubmitEventForm categories={categories ?? []} />
      </div>
    </main>
  )
}
