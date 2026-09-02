import Link from 'next/link'
import type { Metadata } from 'next'

import { Section } from '@/components/layout/section'
import { SectionHeading } from '@/components/ui/section-heading'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/layout/container'
import { LaunchWaitlist } from '@/components/marketing/LaunchWaitlist'

// This page describes something nobody can buy yet. Vendor storefronts are
// gated at the Growth tier (lib/marketplace/entitlements.ts), and Growth is
// deliberately not for sale — decision D-M, 2026-09-01. So the page captures
// interest and says plainly that it is not open, rather than running a
// "Apply for Early Vendor Access" CTA into /sign-up, which was an application
// flow that does not exist.
export const metadata: Metadata = {
  title: 'For Vendors | The BLACQList',
  description:
    'Vendor storefronts on the BLACQList Marketplace are not open yet. Get your business listed today and join the waitlist to hear the day selling opens.',
}

const WAITLIST_OPTIONS = [{ value: 'for-vendors', label: 'Marketplace vendor access' }]

export default function ForVendorsPage() {
  return (
    <>
      <section className="bg-deep-bg" aria-labelledby="for-vendors-heading">
        <Container className="py-16 md:py-24">
          <p className="font-subhead text-gold text-xs uppercase tracking-[0.2em] mb-3">
            For Vendors
          </p>
          <h1
            id="for-vendors-heading"
            className="font-headline text-4xl md:text-5xl text-white leading-tight mb-4"
          >
            Selling isn&apos;t open yet. Getting listed is.
          </h1>
          <p className="font-subhead text-pale-lavender text-lg leading-relaxed max-w-xl mb-8">
            The BLACQList Marketplace will connect Black-owned vendors with buyers who are actively
            seeking to support businesses like yours. We are not taking vendor sign-ups yet — but the
            directory is live, and a listing is where every storefront will start.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              asChild
              className="bg-amber-gold text-brand-black font-body font-bold hover:bg-light-gold rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <Link href="/for-business">List your business</Link>
            </Button>
            <Button
              asChild
              className="border border-white/40 text-white bg-transparent hover:bg-white/10 rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <Link href="#for-vendors-waitlist">Tell me when selling opens</Link>
            </Button>
          </div>
        </Container>
      </section>

      <Section variant="white">
        <span className="inline-block rounded-full border border-charcoal/30 text-charcoal text-xs font-subhead font-semibold px-3 py-1 mb-5">
          Not open yet
        </span>
        <SectionHeading subtitle="Vendor storefronts are the next chapter — Black-owned vendors selling products and services directly through the platform.">
          Marketplace vendor access is still being built
        </SectionHeading>
        <p className="font-subhead text-sm text-charcoal mt-4 max-w-xl">
          We are not accepting vendor sign-ups and we are not selling vendor access, because the
          product listings, checkout, and analytics that come with it are not finished. When they
          are, we will email everyone on this list first. In the meantime, getting your business
          into the directory is the step that carries over.
        </p>
        <LaunchWaitlist
          options={WAITLIST_OPTIONS}
          id="for-vendors-waitlist"
          submitLabel="Tell me when it opens"
          successMessage="You're on the list. We'll email you the day vendor access opens."
        />
      </Section>
    </>
  )
}
