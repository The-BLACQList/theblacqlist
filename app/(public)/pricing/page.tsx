import Link from 'next/link'
import type { Metadata } from 'next'

import { Section } from '@/components/layout/section'
import { SectionHeading } from '@/components/ui/section-heading'
import { PageHeader } from '@/components/layout/page-header'
import { Container } from '@/components/layout/container'
import { Button } from '@/components/ui/button'
import { PricingPlans } from './PricingPlans'

export const metadata: Metadata = {
  title: 'Pricing | The BLACQList',
  description:
    'Getting listed is free forever. Upgrade to Standard or Premium for priority placement, analytics, and featured visibility.',
}

const FAQ_ITEMS = [
  {
    q: 'Is listing my business really free?',
    a: 'Yes. A full BLACQList Page — with your profile, hours, contact info, social links, and marketplace listings — is free forever. No credit card required.',
  },
  {
    q: 'What do the paid plans add?',
    a: 'Standard unlocks priority search placement, your analytics dashboard, a services list, and the ability to respond to reviews. Premium adds unlimited photos, featured placement, homepage spotlight eligibility, and priority support.',
  },
  {
    q: 'How does annual billing work?',
    a: 'Choose annual at checkout and you pay for ten months instead of twelve — two months free. You can switch between monthly and annual anytime from your billing portal.',
  },
  {
    q: 'What is a Sponsored Spotlight?',
    a: 'A high-visibility paid placement on the BLACQList homepage, city pages, and category views. Inventory is limited — Sponsored Spotlight slots are available as an add-on separate from the monthly plans.',
  },
  {
    q: 'What is BLACQ Boost?',
    a: 'A short-term boost that surfaces your listing higher in search results and relevant category pages. Pay once, boost for 30 days.',
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

export default function PricingPage() {
  return (
    <>
      {/* Header */}
      <Section variant="pale-lavender">
        <PageHeader
          title="BLACQList Pricing"
          subtitle="Getting listed is always free. Upgrade to Standard or Premium for priority placement, analytics, and featured visibility — pay monthly or save with annual billing."
        />
      </Section>

      {/* Plan grid */}
      <Section variant="white">
        <SectionHeading subtitle="Start free and upgrade any time. Annual billing gives you two months free.">
          Plans for every stage of growth
        </SectionHeading>

        <PricingPlans />
      </Section>

      {/* Add-ons */}
      <Section variant="cream">
        <SectionHeading subtitle="Boost your visibility beyond your monthly plan — pay only when you need it.">
          Add-ons & Visibility Boosts
        </SectionHeading>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 max-w-3xl">
          {/* Sponsored Spotlight */}
          <div className="rounded-xl border border-charcoal/15 bg-white p-6">
            <span className="inline-block rounded-full bg-amber-gold/15 text-amber text-xs font-subhead font-semibold px-2.5 py-1 mb-3">
              Limited Inventory
            </span>
            <h3 className="font-headline text-lg text-brand-black mb-1">Sponsored Spotlight</h3>
            <p className="font-subhead text-sm text-charcoal mb-3">
              High-visibility placement on the BLACQList homepage, city pages, and category views.
            </p>
            <p className="font-headline text-2xl text-brand-black mb-4">
              $299–$999
              <span className="font-subhead text-sm text-charcoal-soft ml-1">/mo</span>
            </p>
            <Button
              asChild
              className="w-full rounded-full bg-brand-black text-white font-body font-bold hover:bg-charcoal min-h-[44px] h-auto text-sm"
            >
              <Link href="/for-sponsors">Learn More</Link>
            </Button>
          </div>

          {/* BLACQ Boost */}
          <div className="rounded-xl border border-charcoal/15 bg-white p-6">
            <span className="inline-block rounded-full bg-pale-lavender text-brand-black text-xs font-subhead font-semibold px-2.5 py-1 mb-3">
              Pay Once
            </span>
            <h3 className="font-headline text-lg text-brand-black mb-1">BLACQ Boost</h3>
            <p className="font-subhead text-sm text-charcoal mb-3">
              Boost your listing in search results and category pages for a focused 30-day window.
            </p>
            <p className="font-headline text-2xl text-brand-black mb-4">
              $49–$99
              <span className="font-subhead text-sm text-charcoal-soft ml-1">/ 30 days</span>
            </p>
            <Button
              asChild
              className="w-full rounded-full bg-brand-black text-white font-body font-bold hover:bg-charcoal min-h-[44px] h-auto text-sm"
            >
              <Link href="/sign-up">Join the Waitlist</Link>
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
        <SectionHeading subtitle="Every business starts with a free listing — no credit card required. Upgrade when paid plans launch.">
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
