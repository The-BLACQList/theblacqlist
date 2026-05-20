import Link from 'next/link'
import type { Metadata } from 'next'

import { Section } from '@/components/layout/section'
import { SectionHeading } from '@/components/ui/section-heading'
import { PageHeader } from '@/components/layout/page-header'
import { Container } from '@/components/layout/container'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Pricing | The BLACQList',
  description:
    'Getting listed is free forever. Paid tiers with advanced features and premium visibility are coming soon — join the waitlist.',
}

interface Plan {
  key: string
  name: string
  price: string
  period: string
  tagline: string
  features: string[]
  cta: string
  href: string
  featured: boolean
}

const PLANS: Plan[] = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline: 'Everything you need to get discovered.',
    features: [
      'Full BLACQList Page',
      'Hours, contact & social links',
      'Marketplace listings (products & services)',
      'Community reviews',
      'Basic analytics',
    ],
    cta: 'List Your Business Free',
    href: '/for-business',
    featured: false,
  },
  {
    key: 'starter',
    name: 'Starter',
    price: '$19',
    period: '/mo',
    tagline: 'Stand out and be verified.',
    features: [
      'Everything in Free',
      'Verified badge on your page',
      'Priority placement in search',
      'Advanced analytics dashboard',
      'Remove “Powered by BLACQList” badge',
    ],
    cta: 'Join the Waitlist',
    href: '/sign-up',
    featured: false,
  },
  {
    key: 'growth',
    name: 'Growth',
    price: '$49',
    period: '/mo',
    tagline: 'Grow with featured placements and editorial exposure.',
    features: [
      'Everything in Starter',
      'Featured collection placement',
      'BLACQLight editorial eligibility',
      'Marketplace category spotlight',
      'Priority support',
    ],
    cta: 'Join the Waitlist',
    href: '/sign-up',
    featured: true,
  },
  {
    key: 'premium',
    name: 'Premium',
    price: '$99',
    period: '/mo',
    tagline: 'The full platform, front and center.',
    features: [
      'Everything in Growth',
      'Sponsored Spotlight credit ($299 value)',
      'Homepage featured placement',
      'Dedicated account support',
      'Early access to new features',
    ],
    cta: 'Join the Waitlist',
    href: '/sign-up',
    featured: false,
  },
]

const FAQ_ITEMS = [
  {
    q: 'Is listing my business really free?',
    a: 'Yes. A full BLACQList Page — with your profile, hours, contact info, social links, and marketplace listings — is free forever. No credit card required.',
  },
  {
    q: 'When will paid plans launch?',
    a: "We're finalizing pricing and rolling out in phases. Sign up for a free listing now and you'll be the first to know when paid plans become available.",
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
    a: 'Yes. No long-term contracts. All paid plans are billed monthly and can be canceled at any time.',
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
          subtitle="Getting listed is always free. Paid tiers with advanced features and premium visibility are coming soon — join the waitlist to be notified."
        />
      </Section>

      {/* Plan grid */}
      <Section variant="white">
        <SectionHeading subtitle="Annual billing saves up to 20% — pricing announced at launch.">
          Plans for every stage of growth
        </SectionHeading>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-8">
          {PLANS.map((plan) => (
            <div
              key={plan.key}
              className={`relative flex flex-col rounded-xl border p-6 ${
                plan.featured ? 'border-amber-gold ring-1 ring-amber-gold' : 'border-charcoal/15'
              }`}
            >
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-block rounded-full bg-amber-gold text-brand-black text-xs font-subhead font-bold px-3 py-1 whitespace-nowrap">
                  Most Popular
                </span>
              )}

              <div className="mb-4">
                <h3 className="font-headline text-xl text-brand-black mb-1">{plan.name}</h3>
                <p className="font-subhead text-xs text-charcoal/60 mb-3">{plan.tagline}</p>
                <div className="flex items-baseline gap-1">
                  <span className="font-headline text-3xl text-brand-black">{plan.price}</span>
                  <span className="font-subhead text-sm text-charcoal/50">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2 font-subhead text-sm text-charcoal"
                  >
                    <span
                      className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-gold"
                      aria-hidden="true"
                    />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className={`w-full rounded-full font-body font-bold min-h-[44px] h-auto text-sm ${
                  plan.featured
                    ? 'bg-amber-gold text-brand-black hover:bg-light-gold'
                    : plan.key === 'free'
                      ? 'bg-brand-black text-white hover:bg-charcoal'
                      : 'border border-brand-black bg-white text-brand-black hover:bg-brand-black hover:text-white transition-colors'
                }`}
              >
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </Section>

      {/* Add-ons */}
      <Section variant="cream">
        <SectionHeading subtitle="Boost your visibility beyond your monthly plan — pay only when you need it.">
          Add-ons & Visibility Boosts
        </SectionHeading>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 max-w-3xl">
          {/* Sponsored Spotlight */}
          <div className="rounded-xl border border-charcoal/15 bg-white p-6">
            <span className="inline-block rounded-full bg-amber-gold/15 text-amber-gold text-xs font-subhead font-semibold px-2.5 py-1 mb-3">
              Limited Inventory
            </span>
            <h3 className="font-headline text-lg text-brand-black mb-1">Sponsored Spotlight</h3>
            <p className="font-subhead text-sm text-charcoal mb-3">
              High-visibility placement on the BLACQList homepage, city pages, and category views.
            </p>
            <p className="font-headline text-2xl text-brand-black mb-4">
              $299–$999
              <span className="font-subhead text-sm text-charcoal/50 ml-1">/mo</span>
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
              <span className="font-subhead text-sm text-charcoal/50 ml-1">/ 30 days</span>
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
                  className="mt-0.5 shrink-0 text-charcoal/40 group-open:rotate-45 transition-transform"
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
          <p className="font-subhead text-amber-gold text-xs uppercase tracking-[0.2em] mb-3">
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
