import Link from 'next/link'
import type { Metadata } from 'next'

import { Section } from '@/components/layout/section'
import { SectionHeading } from '@/components/ui/section-heading'
import { PageHeader } from '@/components/layout/page-header'
import { Container } from '@/components/layout/container'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { getPlanAvailability, isPlanPurchasable } from '@/lib/stripe/availability'
import { PLANS } from '@/lib/stripe/plans'
import { PricingPlans } from './PricingPlans'
import { LaunchWaitlist, type WaitlistOption } from '@/components/marketing/LaunchWaitlist'

// The page reflects the live `plans` table, so it must not be a build-time
// snapshot: withholding a tier is a data change, and a prerendered page would
// keep advertising it as purchasable until the next deploy.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pricing | The BLACQList',
  description:
    'Getting listed is free forever. Upgrade to Starter for a verified badge, richer media, review responses, and your analytics dashboard. Growth and Premium are coming.',
}

// COPY HONESTY: only Free and Starter are purchasable at launch. Growth and
// Premium are described in the future tense everywhere on this page, and the
// two add-ons carry no advertised price because neither has a purchase path
// yet. The tier CARDS get their disabled/"Coming Soon" state from the live
// `plans` table via lib/stripe/availability.ts — so withholding a tier is a
// data change, and this file only has to make sure the prose around the cards
// never promises what the cards won't sell.

// A withheld tier needs somewhere for the demand to go, or the page just says
// no. `value` must match ALLOWED_SOURCES in
// lib/actions/subscribers/subscribeLaunch.ts.
const WAITLIST_SOURCE: Record<string, string> = {
  growth: 'pricing-growth',
  premium: 'pricing-premium',
}

const FAQ_ITEMS = [
  {
    q: 'Is listing my business really free?',
    a: 'Yes. A full BLACQList Page is free forever: your profile, hours, contact info, social links, and marketplace listings. No credit card required.',
  },
  {
    q: 'What does Starter add?',
    a: 'Starter unlocks your verified badge, more photos and video, an FAQ section, review responses, and your analytics dashboard. It is the paid plan available today.',
  },
  {
    q: 'When are Growth and Premium available?',
    a: 'Not yet. Growth will add priority search placement, a products-and-services storefront, events and team members, featured collection and BLACQLight eligibility, full analytics, and priority support. Premium will add coupons, booking requests, multiple locations, homepage featured placement, and category exclusivity. We are not selling either until every feature on the list actually works — join the waitlist and we will tell you the day it does.',
  },
  {
    q: 'How does annual billing work?',
    a: 'Choose annual at checkout and you save about 20%, a little more than two months free. You can switch between monthly and annual anytime from your billing portal.',
  },
  {
    q: 'What is a Sponsored Spotlight?',
    a: 'A high-visibility paid placement on the BLACQList homepage, city pages, and category views, with limited inventory. It is not available for purchase yet — pricing will be published when it opens.',
  },
  {
    q: 'What is BLACQ Boost?',
    a: 'A short-term boost that surfaces your listing higher in search results and relevant category pages for a focused 30-day window. It is not available for purchase yet — pricing will be published when it opens.',
  },
  {
    q: 'Can I cancel a paid plan anytime?',
    a: 'Yes. No long-term contracts. Manage or cancel your plan anytime from your billing portal in the dashboard.',
  },
  {
    q: 'Do I need a credit card to get started?',
    a: 'No. The Free plan requires no payment information at all.',
  },
]

export default async function PricingPage() {
  const supabase = await createClient()
  const availability = await getPlanAvailability(supabase)

  // A tier earns a waitlist slot when neither cycle can be bought. Offering one
  // for a tier that is merely annual-only would send a buyer to a form instead
  // of to checkout. Both add-ons are always listed — neither has a purchase
  // path, and BLACQ Boost's CTA points here.
  const waitlistOptions: WaitlistOption[] = [
    ...PLANS.flatMap((p) => {
      const value = WAITLIST_SOURCE[p.slug]
      if (
        !value ||
        isPlanPurchasable(availability, p.slug, 'monthly') ||
        isPlanPurchasable(availability, p.slug, 'annual')
      ) {
        return []
      }
      return [{ value, label: p.name }]
    }),
    { value: 'pricing-addons', label: 'Add-ons (Spotlight or Boost)' },
  ]

  return (
    <>
      {/* Header */}
      <Section variant="pale-lavender">
        <PageHeader
          title="BLACQList Pricing"
          subtitle="Getting listed is always free. Upgrade to Starter for a verified badge, richer media, review responses, and your analytics dashboard. Pay monthly or save about 20% with annual billing. Growth and Premium are on the way."
        />
      </Section>

      {/* Plan grid */}
      <Section variant="white">
        <SectionHeading subtitle="Start free and upgrade any time. Annual billing gives you two months free.">
          Plans for every stage of growth
        </SectionHeading>

        <PricingPlans availability={availability} />
      </Section>

      {/* Waitlist for anything not yet purchasable */}
      <Section variant="pale-lavender">
        <SectionHeading subtitle="Growth, Premium, and the visibility add-ons are still being built. Tell us which one you want and we'll email you the day it opens — no charge until then.">
          Waiting on something?
        </SectionHeading>

        <LaunchWaitlist options={waitlistOptions} id="pricing-waitlist" />
      </Section>

      {/* Add-ons */}
      <Section variant="cream">
        <SectionHeading subtitle="Extra visibility beyond your monthly plan. Neither is open for purchase yet — add your name and we'll tell you when it is.">
          Add-ons & Visibility Boosts
        </SectionHeading>

        {/* No price is shown on either card. Both had one ($299–$999/mo and
            $49–$99/30 days) with no purchase path behind it — advertising a
            price for something nobody can buy is the exact dishonesty this
            launch pass exists to remove. The prices go back when the products
            do. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 max-w-3xl">
          {/* Sponsored Spotlight */}
          <div className="rounded-xl border border-charcoal/15 bg-white p-6">
            <span className="inline-block rounded-full bg-amber-gold/15 text-amber text-xs font-subhead font-semibold px-2.5 py-1 mb-3">
              Coming Soon
            </span>
            <h3 className="font-headline text-lg text-brand-black mb-1">Sponsored Spotlight</h3>
            <p className="font-subhead text-sm text-charcoal mb-4">
              High-visibility placement on the BLACQList homepage, city pages, and category views.
              Limited inventory. Pricing will be published when it opens.
            </p>
            <Button
              asChild
              className="w-full rounded-full bg-brand-black text-white font-body font-bold hover:bg-charcoal min-h-[44px] h-auto text-sm"
            >
              <Link href="/for-sponsors">Talk to us about sponsorship</Link>
            </Button>
          </div>

          {/* BLACQ Boost */}
          <div className="rounded-xl border border-charcoal/15 bg-white p-6">
            <span className="inline-block rounded-full bg-pale-lavender text-brand-black text-xs font-subhead font-semibold px-2.5 py-1 mb-3">
              Coming Soon
            </span>
            <h3 className="font-headline text-lg text-brand-black mb-1">BLACQ Boost</h3>
            <p className="font-subhead text-sm text-charcoal mb-4">
              Boost your listing in search results and category pages for a focused 30-day window.
              Pay once, no subscription. Pricing will be published when it opens.
            </p>
            <Button
              asChild
              className="w-full rounded-full bg-brand-black text-white font-body font-bold hover:bg-charcoal min-h-[44px] h-auto text-sm"
            >
              {/* Was /sign-up — a button labelled "Join the waitlist" that
                  created an account and captured no interest. It now reaches the
                  form that actually records it. */}
              <Link href="#pricing-waitlist">Join the waitlist</Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section variant="white">
        <SectionHeading subtitle="Still have questions? Reach us at hello@theblacqlist.com">
          Frequently Asked Questions
        </SectionHeading>

        <div className="mt-8 max-w-2xl divide-y divide-charcoal/10">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer items-start justify-between gap-4 font-subhead font-semibold text-sm text-brand-black list-none">
                <span>{item.q}</span>
                <span
                  className="mt-0.5 shrink-0 text-charcoal-faint group-open:rotate-45 transition-transform"
                  aria-hidden="true"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 font-body text-sm text-charcoal leading-relaxed">{item.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* Sponsor teaser */}
      <section className="bg-deep-bg" aria-labelledby="sponsor-teaser-heading">
        <Container className="py-16 md:py-20 text-center">
          <p className="font-subhead text-gold text-xs uppercase tracking-[0.2em] mb-3">
            For Brands & Organizations
          </p>
          <h2
            id="sponsor-teaser-heading"
            className="font-headline text-3xl md:text-4xl text-white mb-4"
          >
            Sponsor the platform powering
            <br className="hidden sm:block" /> Black economic discovery.
          </h2>
          <p className="font-subhead text-pale-lavender text-base max-w-lg mx-auto mb-8">
            Partner with The BLACQList to reach an engaged, intentional audience that spends with
            purpose.
          </p>
          <Button
            asChild
            className="bg-amber-gold text-brand-black font-body font-bold hover:bg-light-gold rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
          >
            <Link href="/for-sponsors">Explore Sponsorship</Link>
          </Button>
        </Container>
      </section>

      {/* Bottom CTA */}
      <Section variant="cream">
        <SectionHeading subtitle="Every business starts with a free listing. No credit card required. Move up to Starter whenever you're ready.">
          Start Free. Grow at Your Pace.
        </SectionHeading>
        <div className="mt-6">
          <Button
            asChild
            className="bg-brand-black text-white font-body font-bold hover:bg-charcoal rounded-full px-7 py-3 min-h-[44px] h-auto"
          >
            <Link href="/for-business">List Your Business Free</Link>
          </Button>
        </div>
      </Section>
    </>
  )
}
