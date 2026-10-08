import { notFound, redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { loadFinishData } from '@/lib/listings/finishData'
import { PageFinishView } from '@/components/listings/PageFinishView'

export const metadata = {
  title: 'Finish your page | The BLACQList',
  robots: { index: false },
}

interface Props {
  params: Promise<{ listingId: string }>
  searchParams: Promise<{ warning?: string }>
}

// Step two of /add-business (ticket 126): the draft exists, now the owner fills
// in the rest beside a live view of the page and sends it for review.
export default async function FinishPage({ params, searchParams }: Props) {
  const [{ listingId }, { warning }] = await Promise.all([params, searchParams])
  if (!/^[0-9a-f-]{36}$/i.test(listingId)) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/sign-in?next=/add-business/finish/${listingId}`)

  const data = await loadFinishData(supabase as unknown as SupabaseClient, listingId, user.id)
  if (!data) notFound()

  const storageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public`

  return (
    <main className="min-h-screen bg-pale-lavender px-4 pt-16 pb-16">
      <div className="mx-auto max-w-[1100px] py-10">
        <div className="mb-8 max-w-[640px]">
          <p className="mb-2 font-subhead text-xs font-semibold uppercase tracking-widest text-amber">
            Get Listed
          </p>
          <h1 className="mb-3 font-headline text-3xl text-brand-black md:text-4xl">
            Finish your page
          </h1>
          <p className="font-subhead text-base leading-relaxed text-charcoal">
            Your draft is saved. Add what you have, skip what you don&apos;t, and send it for review
            whenever you&apos;re ready.
          </p>
        </div>

        <PageFinishView
          data={data}
          mode="new"
          warning={warning === 'request' ? 'request' : null}
          storageUrl={storageUrl}
        />
      </div>
    </main>
  )
}
