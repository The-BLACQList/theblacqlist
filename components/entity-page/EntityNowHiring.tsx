import Link from 'next/link'
import type { Route } from 'next'

import { CardGrid } from '@/components/ui/card-grid'
import { JobCard } from '@/components/jobs/JobCard'
import { isFeatureEnabled } from '@/lib/env'
import { toJobCardData } from '@/lib/listings/jobCard'
import { getOpenRolesForBusiness } from '@/lib/listings/jobs'
import { seeAllRolesLabel } from '@/lib/listings/jobEntryPoints'
import type { DiscoveryEntity } from '@/types'

const MAX_CARDS = 3

interface ViewProps {
  businessId: string
  roles: DiscoveryEntity[]
  total: number
}

/** The visible block. Split from the data read so it renders without a database. */
export function NowHiringView({ businessId, roles, total }: ViewProps) {
  if (roles.length === 0) return null
  return (
    <section aria-labelledby="now-hiring-heading" className="bg-cream py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2
          id="now-hiring-heading"
          className="font-headline text-[22px] md:text-[28px] text-brand-black mb-6"
        >
          Now hiring
        </h2>
        <CardGrid cols={{ base: 1, sm: 2, lg: 3 }} gap="md">
          {roles.map((r) => (
            <JobCard key={r.id} job={toJobCardData(r)} />
          ))}
        </CardGrid>
        {total > roles.length && (
          <Link
            href={`/jobs?business=${businessId}` as Route}
            className="mt-6 inline-flex min-h-[44px] items-center font-subhead text-sm font-semibold text-amber hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
          >
            {seeAllRolesLabel(total)}
          </Link>
        )}
      </div>
    </section>
  )
}

interface Props {
  /** The business page's listing id. */
  listingId: string
}

/**
 * "Now hiring" on a business page (ticket 154): up to three open roles, hidden
 * entirely when there are none, the read fails, or Jobs is not open.
 */
export async function EntityNowHiring({ listingId }: Props) {
  if (!isFeatureEnabled('jobsOpen')) return null
  const result = await getOpenRolesForBusiness(listingId, MAX_CARDS).catch(() => null)
  if (!result) return null
  return <NowHiringView businessId={listingId} roles={result.entities} total={result.total} />
}
