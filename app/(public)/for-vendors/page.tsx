import Link from 'next/link'
import type { Metadata } from 'next'

import { Section } from '@/components/layout/section'
import { SectionHeading } from '@/components/ui/section-heading'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/layout/container'
import { LaunchWaitlist } from '@/components/marketing/LaunchWaitlist'
import { createClient } from '@/lib/supabase/server'
import { getPlanAvailability, isTierOpen } from '@/lib/stripe/availability'

// Vendor storefronts are gated at the Growth tier (lib/marketplace/entitlements.ts).
// Growth was withheld from sale (decision D-M, 2026-09-01) and opens on its own
// before Premium (ticket 143). While it is closed, this page captures interest
// and says plainly that selling is not open. Once the live `plans` table can
// sell Growth, it says storefronts come with Growth and points at pricing. Both
// states read the same availability as the pricing cards, so the page flips
// with the data and never promises what checkout would refuse.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'For Vendors | The BLACQList',
  description:
    'Sell products and services from your BLACQList business page. Get listed free today, and see what a storefront needs.',
}

const WAITLIST_OPTIONS = [{ value: 'for-vendors', label: 'Marketplace vendor access' }]

const STOREFRONT_POINTS = [
  'Up to 25 products and services on each business page',
  'Your own storefront page that buyers can browse',
  'Buyers buy or book straight from you, through your own link',
]

export default async function ForVendorsPage() {
  const supabase = await createClient()
  const growthOpen = isTierOpen(await getPlanAvailability(supabase), 'growth')

  return growthOpen ? <SellingOpen /> : <SellingClosed />
}

function SellingOpen() {
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
            Sell from your BLACQList page.
          </h1>
          <p className="font-subhead text-pale-lavender text-lg leading-relaxed max-w-xl mb-8">
            Storefronts come with the Growth plan. Start with a free listing, then move it to
            Growth to add the products and services you sell.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              asChild
              className="bg-amber-gold text-brand-black font-body font-bold hover:bg-light-gold rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <Link href="/for-business#start">List your business</Link>
            </Button>
            <Button
              asChild
              className="border border-white/40 text-white bg-transparent hover:bg-white/10 rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <Link href="/pricing">See Growth pricing</Link>
            </Button>
          </div>
        </Container>
      </section>

      <Section variant="white">
        <SectionHeading subtitle="What a storefront gives each business page on Growth.">
          What comes with a storefront
        </SectionHeading>
        <ul className="mt-6 max-w-xl list-disc ml-5 space-y-2 font-subhead text-sm text-charcoal">
          {STOREFRONT_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p className="font-subhead text-sm text-charcoal mt-6 max-w-xl">
          Already listed? Move your page to Growth from{' '}
          <Link href="/dashboard/upgrade" className="text-amber underline underline-offset-4">
            Upgrade
          </Link>{' '}
          in your dashboard.
        </p>
      </Section>
    </>
  )
}

function SellingClosed() {
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
              <Link href="/for-business#start">List your business</Link>
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
