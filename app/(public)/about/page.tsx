import Link from "next/link"
import type { Metadata } from "next"

import { Section } from "@/components/layout/section"
import { SectionHeading } from "@/components/ui/section-heading"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "About | The BLACQList",
  description:
    "We started in Atlanta with a simple belief: Black-owned businesses deserve better tools and more visibility. Today, that belief is a national platform.",
}

const PILLARS = [
  {
    title: "Discovery with Depth",
    body: "Not just a list of names — full business profiles that tell the story behind each venture.",
  },
  {
    title: "Community Trust",
    body: "A verification system built on real documentation and community reviews, not pay-to-play badges.",
  },
  {
    title: "Economic Circulation",
    body: "Tools that help dollars move through Black communities — and show the impact in real time.",
  },
  {
    title: "Cultural Specificity",
    body: "Built for Black-owned businesses specifically, not adapted from a generic directory.",
  },
]

export default function AboutPage() {
  return (
    <>
      <Section variant="pale-lavender">
        <PageHeader
          title="About The BLACQList"
          subtitle="Atlanta-born. National from day one. Community-powered everywhere."
        />
      </Section>

      <Section variant="white">
        <div className="max-w-2xl">
          <SectionHeading subtitle="2024 · Atlanta, Georgia">
            Where We Started
          </SectionHeading>
          <div className="mt-4 space-y-4 font-subhead text-base text-charcoal leading-relaxed">
            <p>
              We started with a simple observation: Black-owned businesses were
              everywhere, but finding them — reliably, completely, with full
              context — was harder than it should be.
            </p>
            <p>
              Generic directories weren&apos;t built with us in mind. Social media
              pages came and went. Word of mouth couldn&apos;t scale. The tools
              existed, but they weren&apos;t ours.
            </p>
            <p>
              The BLACQList is the platform we built to fix that. A national
              directory with the depth and trust that Black-owned businesses
              deserve, and the discovery experience that Black consumers have
              always needed.
            </p>
          </div>
        </div>
      </Section>

      <Section variant="cream">
        <SectionHeading subtitle="Four principles guide every decision we make.">
          What We Stand For
        </SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {PILLARS.map((pillar) => (
            <div
              key={pillar.title}
              className="rounded-lg border border-pale-lavender bg-white p-6"
            >
              <h3 className="font-headline text-base text-brand-black mb-2">
                {pillar.title}
              </h3>
              <p className="font-subhead text-sm text-charcoal leading-relaxed">
                {pillar.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section variant="deep-bg">
        <div className="max-w-xl">
          <SectionHeading
            onDark
            subtitle="Whether you're finding a business or building one, there's a place for you here."
          >
            Join the Community
          </SectionHeading>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button
              asChild
              className="bg-amber-gold text-brand-black font-body font-bold hover:bg-light-gold rounded-full px-6 py-2.5 min-h-[44px] h-auto"
            >
              <Link href="/for-business">List Your Business</Link>
            </Button>
            <Button
              asChild
              className="border border-white/40 text-white bg-transparent hover:bg-white/10 rounded-full px-6 py-2.5 min-h-[44px] h-auto"
            >
              <Link href="/discover">Explore Businesses</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  )
}
