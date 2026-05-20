import Link from 'next/link'
import type { Metadata } from 'next'

import { Section } from '@/components/layout/section'
import { SectionHeading } from '@/components/ui/section-heading'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/layout/container'

export const metadata: Metadata = {
  title: 'For Vendors | The BLACQList',
  description:
    'Sell on the BLACQList Marketplace. Reach a community that buys intentionally and put your products in front of the right audience.',
}

export default function ForVendorsPage() {
  return (
    <>
      <section className="bg-deep-bg" aria-labelledby="for-vendors-heading">
        <Container className="py-16 md:py-24">
          <p className="font-subhead text-amber-gold text-xs uppercase tracking-[0.2em] mb-3">
            For Vendors
          </p>
          <h1
            id="for-vendors-heading"
            className="font-headline text-4xl md:text-5xl text-white leading-tight mb-4"
          >
            Sell to the community that buys intentionally.
          </h1>
          <p className="font-subhead text-pale-lavender text-lg leading-relaxed max-w-xl mb-8">
            The BLACQList Marketplace connects Black-owned vendors with buyers who are actively
            seeking to support businesses like yours.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              asChild
              className="bg-amber-gold text-brand-black font-body font-bold hover:bg-light-gold rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <Link href="/sign-up">Apply for Early Vendor Access</Link>
            </Button>
            <Button
              asChild
              className="border border-white/40 text-white bg-transparent hover:bg-white/10 rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <Link href="/for-business">List Your Business First</Link>
            </Button>
          </div>
        </Container>
      </section>

      <Section variant="white">
        <span className="inline-block rounded-full border border-charcoal/30 text-charcoal text-xs font-subhead font-semibold px-3 py-1 mb-5">
          V2 Feature
        </span>
        <SectionHeading subtitle="The Marketplace is the next chapter — letting Black-owned vendors sell products and services directly through the platform.">
          Marketplace Vendor Access Coming in V2
        </SectionHeading>
        <p className="font-subhead text-sm text-charcoal mt-4 max-w-xl">
          We&apos;re accepting early vendor applications now. When the Marketplace launches, early
          applicants will be among the first to go live — with full product listings, checkout, and
          analytics. Start by getting your business listed in the directory today.
        </p>
      </Section>
    </>
  )
}
