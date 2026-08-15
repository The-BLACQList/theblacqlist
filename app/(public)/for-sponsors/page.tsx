import Link from 'next/link'
import type { Metadata } from 'next'

import { Section } from '@/components/layout/section'
import { SectionHeading } from '@/components/ui/section-heading'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/layout/container'

export const metadata: Metadata = {
  title: 'For Sponsors | The BLACQList',
  description:
    'Partner with The BLACQList. Reach an engaged, intentional audience that spends with purpose.',
}

const SPONSOR_TYPES = [
  {
    title: 'Community Partner',
    description:
      'Local businesses and organizations that want to reach Black community members who are actively seeking businesses and services like yours.',
    badge: 'Local',
  },
  {
    title: 'City Spotlight',
    description:
      'Brands and organizations targeting a specific metropolitan area. Get featured placement on BLACQList city pages where your audience already looks.',
    badge: 'Regional',
  },
  {
    title: 'Platform Partner',
    description:
      'National brands aligning with Black economic empowerment. Appear across the full BLACQList network with homepage presence and co-branded editorial.',
    badge: 'National',
  },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Submit an inquiry',
    body: "Tell us about your organization, target audience, and campaign goals. We'll follow up within 2 business days.",
  },
  {
    step: '02',
    title: 'Receive a tailored proposal',
    body: "We'll send a sponsorship proposal with placement options, audience data, and pricing within 5 business days of your inquiry.",
  },
  {
    step: '03',
    title: 'Launch your campaign',
    body: 'Go live with homepage, city-level, or category placements. Your brand alongside the businesses your audience already trusts.',
  },
]

export default function ForSponsorsPage() {
  return (
    <>
      {/* Dark hero — keep existing structure */}
      <section className="bg-deep-bg" aria-labelledby="for-sponsors-heading">
        <Container className="py-16 md:py-24">
          <p className="font-subhead text-gold text-xs uppercase tracking-[0.2em] mb-3">
            For Sponsors &amp; Partners
          </p>
          <h1
            id="for-sponsors-heading"
            className="font-headline text-4xl md:text-5xl text-white leading-tight mb-4"
          >
            Partner with the platform
            <br className="hidden sm:block" />
            powering Black economic discovery.
          </h1>
          <p className="font-subhead text-pale-lavender text-lg leading-relaxed max-w-xl mb-8">
            The BLACQList connects brands and organizations with an engaged, intentional audience
            that actively seeks to support Black-owned businesses and community initiatives.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              asChild
              className="bg-amber-gold text-brand-black font-body font-bold hover:bg-light-gold rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <a href="mailto:sponsors@theblacqlist.com">Request Sponsorship Information</a>
            </Button>
            <Button
              asChild
              className="border border-white/40 text-white bg-transparent hover:bg-white/10 rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <Link href="/about">Learn About BLACQList</Link>
            </Button>
          </div>
        </Container>
      </section>

      {/* Who sponsors BLACQList */}
      <Section variant="white">
        <SectionHeading subtitle="From local community organizations to national brands, we match sponsors with the audiences they want to reach authentically.">
          Who sponsors BLACQList?
        </SectionHeading>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {SPONSOR_TYPES.map((type) => (
            <div key={type.title} className="rounded-xl border border-charcoal/15 p-6">
              <span className="inline-block rounded-full bg-pale-lavender text-brand-black text-xs font-subhead font-semibold px-2.5 py-1 mb-4">
                {type.badge}
              </span>
              <h3 className="font-headline text-lg text-brand-black mb-2">{type.title}</h3>
              <p className="font-body text-sm text-charcoal leading-relaxed">{type.description}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <Section variant="cream">
        <SectionHeading subtitle="Simple, transparent, and built around your goals.">
          How it works
        </SectionHeading>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
          {HOW_IT_WORKS.map((step) => (
            <div key={step.step} className="flex flex-col gap-3">
              <span className="font-headline text-4xl text-gold leading-none">
                {step.step}
              </span>
              <h3 className="font-subhead text-base font-semibold text-brand-black">
                {step.title}
              </h3>
              <p className="font-body text-sm text-charcoal leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Placement add-ons */}
      <Section variant="white">
        <SectionHeading subtitle="Targeted placements available as standalone campaigns or add-ons to a monthly sponsorship.">
          Placement options
        </SectionHeading>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 max-w-3xl">
          {/* Sponsored Spotlight */}
          <div className="rounded-xl border border-charcoal/15 p-6">
            <span className="inline-block rounded-full bg-amber-gold/15 text-gold text-xs font-subhead font-semibold px-2.5 py-1 mb-3">
              Limited Inventory
            </span>
            <h3 className="font-headline text-lg text-brand-black mb-1">Sponsored Spotlight</h3>
            <p className="font-subhead text-sm text-charcoal mb-3">
              High-visibility placement on the BLACQList homepage, city pages, and category views.
              Limited slots available per placement zone.
            </p>
            <p className="font-headline text-2xl text-brand-black mb-1">
              $299–$999
              <span className="font-subhead text-sm text-charcoal-soft ml-1">/mo</span>
            </p>
            <p className="font-body text-xs text-charcoal-soft mb-4">
              Pricing varies by zone and inventory
            </p>
            <Button
              asChild
              className="w-full rounded-full bg-brand-black text-white font-body font-bold hover:bg-charcoal min-h-[44px] h-auto text-sm"
            >
              <a href="mailto:sponsors@theblacqlist.com">Inquire About Spotlight</a>
            </Button>
          </div>

          {/* BLACQ Boost */}
          <div className="rounded-xl border border-charcoal/15 p-6">
            <span className="inline-block rounded-full bg-pale-lavender text-brand-black text-xs font-subhead font-semibold px-2.5 py-1 mb-3">
              Pay Once
            </span>
            <h3 className="font-headline text-lg text-brand-black mb-1">BLACQ Boost</h3>
            <p className="font-subhead text-sm text-charcoal mb-3">
              Boost an individual listing in search results and relevant category pages for a
              focused 30-day window.
            </p>
            <p className="font-headline text-2xl text-brand-black mb-1">
              $49–$99
              <span className="font-subhead text-sm text-charcoal-soft ml-1">/ 30 days</span>
            </p>
            <p className="font-body text-xs text-charcoal-soft mb-4">
              Coming soon. Join the waitlist.
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

      {/* CTA */}
      <Section variant="pale-lavender">
        <div className="text-center max-w-xl mx-auto">
          <SectionHeading subtitle="Email us at sponsors@theblacqlist.com and we'll respond within 2 business days.">
            Ready to partner?
          </SectionHeading>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              className="bg-brand-black text-white font-body font-bold hover:bg-charcoal rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <a href="mailto:sponsors@theblacqlist.com">Request Sponsorship Information</a>
            </Button>
            <Button
              asChild
              className="border border-brand-black bg-transparent text-brand-black hover:bg-brand-black hover:text-white transition-colors rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <Link href="/pricing">View Pricing</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  )
}
