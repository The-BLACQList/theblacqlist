import Link from 'next/link'
import type { Metadata } from 'next'

import { Section } from '@/components/layout/section'
import { SectionHeading } from '@/components/ui/section-heading'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Jobs | The BLACQList',
  description:
    'Find career opportunities at Black-owned companies. Build your career while supporting the community.',
}

export default function JobsPage() {
  return (
    <>
      <Section variant="pale-lavender">
        <PageHeader
          title="Black-Owned Business Jobs"
          subtitle="Find career opportunities at Black-owned companies. Build your future while supporting the community."
        />
      </Section>

      <Section variant="white">
        <span className="inline-block rounded-full border border-amber-gold text-amber text-xs font-subhead font-semibold px-3 py-1 mb-5">
          Beta Feature
        </span>
        <SectionHeading subtitle="The BLACQList jobs board will connect job seekers with Black-owned businesses hiring across every industry and city.">
          Jobs Board Coming in Beta
        </SectionHeading>
        <p className="font-subhead text-sm text-charcoal mt-4 max-w-xl">
          Black-owned businesses will be able to post open roles directly on their BLACQList Page,
          and job seekers will be able to filter opportunities by industry, city, and job type.
          Supporting Black businesses extends to where you work, not just where you spend.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Button
            asChild
            className="bg-brand-black text-white font-body font-bold hover:bg-charcoal rounded-full px-6 py-2.5 min-h-[44px] h-auto"
          >
            <Link href="/sign-up">Get Notified at Launch</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-brand-black text-brand-black font-body font-bold rounded-full px-6 py-2.5 min-h-[44px] h-auto"
          >
            <Link href="/for-business">List Your Business</Link>
          </Button>
        </div>
      </Section>
    </>
  )
}
