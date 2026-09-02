import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'

import { Container } from '@/components/layout/container'
import { DiscoveryGrid } from '@/components/discovery/DiscoveryGrid'
import { queryListings, LISTINGS_PAGE_SIZE } from '@/lib/listings/query'
import { buildPageUrl } from '@/lib/listings/pagination'
import { isFeatureEnabled } from '@/lib/env'

export const metadata: Metadata = {
  title: 'Jobs | The BLACQList',
  description:
    'Open roles at Black-owned businesses, across every industry and city on The BLACQList.',
}

// No `export const revalidate` on purpose — see the note in the events page.

interface JobsPageProps {
  searchParams: Promise<{ page?: string }>
}

const ctaClass =
  'inline-block rounded-full bg-amber-gold px-5 py-2 font-subhead text-sm font-semibold text-brand-black hover:bg-light-gold transition-colors'
const secondaryCtaClass =
  'inline-block rounded-full border border-amber-gold px-5 py-2 font-subhead text-sm font-semibold text-amber hover:bg-amber-gold hover:text-brand-black transition-colors'

async function JobResults({ searchParams }: { searchParams: JobsPageProps['searchParams'] }) {
  const params = await searchParams
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1)

  // queryListings fails soft — a broken read comes back as zero rows, which
  // would render as "nothing posted yet" and be untrue. Only a thrown error
  // reaches here, and it gets the grid's error state rather than the page's.
  let result
  try {
    result = await queryListings({ type: 'job', page })
  } catch {
    return (
      <DiscoveryGrid
        entities={[]}
        total={0}
        error="We couldn't load jobs just now. Refresh the page to try again."
      />
    )
  }

  const canPost = isFeatureEnabled('postingSubmissions')

  if (result.entities.length === 0) {
    // Past the last page of a non-empty list is a different emptiness from an
    // empty board, and it needs a way back rather than a way to post.
    if (page > 1) {
      return (
        <div className="rounded-xl bg-pale-lavender px-8 py-10 text-center space-y-4">
          <p className="font-headline text-xl text-brand-black">Nothing on this page</p>
          <p className="font-body text-sm text-charcoal leading-relaxed">
            There are no jobs this far into the list.
          </p>
          <div className="pt-2">
            <Link href="/jobs" className={ctaClass}>
              Back to the first page
            </Link>
          </div>
        </div>
      )
    }

    return (
      <div className="rounded-xl bg-pale-lavender px-8 py-10 text-center space-y-4">
        <p className="font-headline text-xl text-brand-black">No open roles right now</p>
        <p className="font-body text-sm text-charcoal leading-relaxed">
          Jobs appear here once businesses post them and our team approves them. Check back soon.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          {canPost && (
            <Link href="/add-job" className={ctaClass}>
              Post a job
            </Link>
          )}
          <Link href="/discover" className={secondaryCtaClass}>
            Browse businesses
          </Link>
        </div>
      </div>
    )
  }

  const nextPageUrl =
    result.total > page * LISTINGS_PAGE_SIZE ? buildPageUrl(params, page + 1) : undefined

  return (
    <DiscoveryGrid
      entities={result.entities}
      total={result.total}
      nextPageUrl={nextPageUrl}
      currentPage={page}
    />
  )
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const canPost = isFeatureEnabled('postingSubmissions')

  return (
    <>
      <div className="border-b border-charcoal/10 bg-white">
        <Container className="py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-headline text-2xl md:text-3xl text-brand-black">
                Black-Owned Business Jobs
              </h1>
              <p className="font-subhead text-sm text-charcoal mt-1.5 max-w-xl">
                Open roles at Black-owned businesses. Supporting Black businesses extends to where
                you work, not just where you spend.
              </p>
            </div>
            {canPost && (
              <Link href="/add-job" className={`${ctaClass} shrink-0 self-start sm:self-auto`}>
                Post a job
              </Link>
            )}
          </div>
        </Container>
      </div>

      <Container className="py-8">
        <Suspense fallback={<DiscoveryGrid entities={[]} total={0} isLoading />}>
          <JobResults searchParams={searchParams} />
        </Suspense>
      </Container>
    </>
  )
}
