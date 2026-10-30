import Link from 'next/link'
import type { Route } from 'next'
import Image from 'next/image'

import type { JobHiring } from '@/types'

interface Props {
  hiring: JobHiring
}

export function JobAboutBusiness({ hiring }: Props) {
  return (
    <section aria-labelledby="job-business-heading">
      <h2 id="job-business-heading" className="font-headline text-xl text-brand-black mb-3">
        About the business
      </h2>
      <div className="flex items-start gap-4 rounded-xl border border-charcoal/10 p-4">
        {hiring.logoUrl && (
          <Image
            src={hiring.logoUrl}
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-full object-cover bg-pale-lavender"
          />
        )}
        <div className="min-w-0">
          <p className="font-subhead text-base font-semibold text-brand-black">{hiring.name}</p>
          {hiring.tagline && (
            <p className="font-body text-sm text-charcoal mt-0.5">{hiring.tagline}</p>
          )}
          {hiring.cityName && (
            <p className="font-body text-xs text-charcoal-soft mt-0.5">{hiring.cityName}</p>
          )}
          <Link
            href={hiring.url as Route}
            className="inline-flex items-center min-h-11 font-subhead text-sm font-semibold text-brand-black underline decoration-amber-gold underline-offset-2 hover:decoration-2"
          >
            View their page
            <span className="sr-only"> for {hiring.name}</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
