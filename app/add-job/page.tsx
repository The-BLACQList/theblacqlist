import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { SubmitJobForm } from '@/components/listings/SubmitJobForm'

export const metadata = {
  title: 'Post a Job | The BLACQList',
  description: 'Post an open role at a Black-owned business or ally organization.',
}

// Required, not incidental: a flag read during static prerendering is baked into
// the HTML at BUILD time, so flipping FEATURE_POSTING_SUBMISSIONS and redeploying
// the same commit would not change what this route serves. See lib/env.ts.
export const dynamic = 'force-dynamic'

export default async function AddJobPage() {
  if (!isFeatureEnabled('postingSubmissions')) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/add-job')

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
          <h1 className="font-headline text-3xl md:text-4xl text-brand-black mb-3">Post a job</h1>
          <p className="font-subhead text-sm text-charcoal leading-relaxed max-w-lg">
            Share an open role. Submissions are reviewed by our team before going live.
          </p>
        </div>

        <SubmitJobForm categories={categories ?? []} />
      </div>
    </main>
  )
}
