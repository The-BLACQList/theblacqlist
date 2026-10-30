import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'

import { Container } from '@/components/layout/container'
import { CardGrid } from '@/components/ui/card-grid'
import { JobCard, JobCardSkeleton } from '@/components/jobs/JobCard'
import { JobFilters, JobFiltersFallback } from '@/components/jobs/JobFilters'
import { JobsEmpty, JobsError, JobsNoMatch } from '@/components/jobs/JobsBoardStates'
import { toJobCardData } from '@/lib/listings/jobCard'
import { getJobFilterOptions, queryJobs, type JobFilterOptions } from '@/lib/listings/jobs'
import { LISTINGS_PAGE_SIZE } from '@/lib/listings/query'
import { buildJobsUrl, hasJobFilters, parseJobFilters } from '@/lib/validations/jobs'
import { createClient } from '@/lib/supabase/server'
import { isFeatureEnabled } from '@/lib/env'

export const metadata: Metadata = {
  title: 'Jobs | The BLACQList',
  description:
    'Open roles at Black-owned businesses, across every industry and city on The BLACQList.',
}

// No `export const revalidate` on purpose — see the note in the events page.

interface JobsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const ctaClass =
  'inline-flex min-h-[44px] items-center justify-center rounded-full bg-amber-gold px-5 font-subhead text-sm font-semibold text-brand-black transition-colors hover:bg-light-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber'
const noOptions: JobFilterOptions = { hasRemote: false, cities: [] }

function GridSkeleton() {
  return (
    <CardGrid cols={{ base: 1, sm: 2, lg: 3 }} gap="md">
      {Array.from({ length: 6 }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </CardGrid>
  )
}

/** Signed in with a business of their own. Fails soft: a miss means "not an owner". */
async function isBusinessOwner(): Promise<boolean> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false
    const { count } = await supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('owner_user_id', user.id)
      .is('deleted_at', null)
    return (count ?? 0) > 0
  } catch {
    return false
  }
}

async function JobResults({ searchParams }: { searchParams: JobsPageProps['searchParams'] }) {
  const filters = parseJobFilters(await searchParams)
  const filtered = hasJobFilters(filters)

  // The options read is separate so a failure there never hides the grid, and the
  // chips stay on screen when the grid read fails.
  const optionsP = getJobFilterOptions().catch(() => noOptions)
  let result
  try {
    result = await queryJobs(filters)
  } catch {
    return (
      <div className="space-y-6">
        <JobFilters options={await optionsP} />
        <JobsError />
      </div>
    )
  }
  const options = await optionsP

  let body
  if (result.entities.length === 0 && filters.page > 1) {
    body = (
      <div className="space-y-4 rounded-xl bg-pale-lavender px-8 py-10 text-center">
        <p className="font-headline text-xl text-brand-black">Nothing on this page</p>
        <Link href={buildJobsUrl(filters)} className={ctaClass}>
          Back to the first page
        </Link>
      </div>
    )
  } else if (result.entities.length === 0 && filtered) {
    body = <JobsNoMatch />
  } else if (result.entities.length === 0) {
    body = (
      <JobsEmpty
        isOwner={await isBusinessOwner()}
        postHref={isFeatureEnabled('postingSubmissions') ? '/add-job' : undefined}
      />
    )
  } else {
    body = (
      <>
        <CardGrid cols={{ base: 1, sm: 2, lg: 3 }} gap="md">
          {result.entities.map((e) => (
            <JobCard key={e.id} job={toJobCardData(e)} />
          ))}
        </CardGrid>
        {result.total > filters.page * LISTINGS_PAGE_SIZE && (
          <div className="mt-10 flex justify-center">
            <Link
              href={buildJobsUrl(filters, filters.page + 1)}
              className="inline-flex min-h-[44px] items-center rounded-full border border-charcoal/30 px-8 font-body text-sm font-bold text-brand-black transition-colors hover:bg-pale-lavender"
            >
              Load more
            </Link>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="space-y-6">
      {filters.business && (
        <p className="font-body text-sm text-charcoal">
          Showing roles at one business.{' '}
          <Link href="/jobs" className="font-semibold text-amber hover:underline">
            Show all roles
          </Link>
        </p>
      )}
      <JobFilters options={options} total={result.total} />
      {body}
    </div>
  )
}

export default function JobsPage({ searchParams }: JobsPageProps) {
  const canPost = isFeatureEnabled('postingSubmissions')

  return (
    <>
      <div className="border-b border-charcoal/10 bg-white">
        <Container className="py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-headline text-2xl md:text-3xl text-brand-black">Jobs</h1>
              <p className="font-subhead text-sm text-charcoal mt-1.5 max-w-xl">
                Open roles at Black-owned businesses
              </p>
            </div>
            {canPost && (
              <Link href="/add-job" className={`${ctaClass} w-full shrink-0 sm:w-auto`}>
                Post a job
              </Link>
            )}
          </div>
        </Container>
      </div>

      <Container className="py-8">
        <Suspense
          fallback={
            <div className="space-y-6">
              <JobFiltersFallback />
              <GridSkeleton />
            </div>
          }
        >
          <JobResults searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  )
}
