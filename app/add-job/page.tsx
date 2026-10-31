import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'
import { resolveMediaPath } from '@/lib/listings/coverImage'
import { JOB_POSTING_PRICE_DISPLAY, jobQuotaFor } from '@/lib/stripe/jobPostings'
import { buildJobPriceLine } from '@/lib/listings/jobPriceLine'
import { PostJobWizard } from '@/components/jobs/post/PostJobWizard'
import type { HiringBusiness } from '@/components/jobs/post/types'
import { loadOpenClaims, resolvePostingReadiness, type PostingReadiness } from '@/lib/jobs/postingReadiness'

export const metadata = {
  title: 'Post a Job | The BLACQList',
  description: 'Post an open role in four short steps.',
}

// Required, not incidental: a flag read during static prerendering is baked into
// the HTML at BUILD time, so flipping FEATURE_POSTING_SUBMISSIONS and redeploying
// the same commit would not change what this route serves. See lib/env.ts.
export const dynamic = 'force-dynamic'

interface BusinessRow {
  id: string
  name: string
  status: string
  entity_type: string
  logo_path: string | null
  cities: { name: string; state_abbr: string | null } | { name: string; state_abbr: string | null }[] | null
}

interface Props {
  searchParams: Promise<{ canceled?: string }>
}

export default async function AddJobPage({ searchParams }: Props) {
  const canceled = (await searchParams).canceled === '1'
  if (!isFeatureEnabled('postingSubmissions')) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in?next=/add-job')

  // Ticket 156: drafts and pending pages are read too, so the form can say which
  // step the user is on. Only published pages go in the business picker.
  const jobsOpen = isFeatureEnabled('jobsOpen')
  const [{ data: categories }, { data: owned, error: ownedError }, quotaRead, openClaims] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, slug, parent_id')
      .eq('is_active', true)
      .order('display_order'),
    supabase
      .from('listings')
      .select('id, name, status, entity_type, logo_path, cities(name, state_abbr)')
      .eq('owner_user_id', user.id)
      .in('status', ['draft', 'pending', 'published'])
      .is('deleted_at', null)
      .not('entity_type', 'in', '(event,job)')
      .order('name'),
    jobQuotaFor(supabase, user.id),
    jobsOpen ? loadOpenClaims(supabase, user.id) : Promise.resolve([]),
  ])

  const ownedRows = (owned ?? []) as unknown as BusinessRow[]
  // A failed owned read keeps today's plain empty state rather than a wrong step.
  const readiness: PostingReadiness | null =
    jobsOpen && !ownedError ? resolvePostingReadiness(ownedRows, openClaims) : null

  const businesses: HiringBusiness[] = ownedRows.filter((b) => b.status === 'published').map((b) => {
    const city = Array.isArray(b.cities) ? b.cities[0] : b.cities
    return {
      id: b.id,
      name: b.name,
      logoUrl: resolveMediaPath(b.logo_path),
      cityName: city?.name ?? null,
      stateAbbr: city?.state_abbr ?? null,
    }
  })

  const priceLine = buildJobPriceLine(quotaRead, JOB_POSTING_PRICE_DISPLAY, isFeatureEnabled('paidPostings'))

  return (
    <main className="min-h-screen bg-pale-lavender pt-16 pb-16 px-4">
      <div className="max-w-5xl mx-auto py-10">
        <div className="mb-8">
          <p className="font-subhead text-xs font-semibold uppercase tracking-widest text-jobs-ink mb-2">
            Jobs
          </p>
          <h1 className="font-headline text-3xl md:text-4xl text-brand-black mb-3">Post a job</h1>
          <p className="font-subhead text-sm text-charcoal leading-relaxed max-w-lg">
            Four short steps. Our team reviews every role before it goes live.
          </p>
        </div>

        <PostJobWizard
          businesses={businesses}
          categories={categories ?? []}
          priceLine={priceLine}
          canceled={canceled}
          readiness={readiness}
        />
      </div>
    </main>
  )
}
