import Link from "next/link"
import type { Metadata } from "next"

import { Container } from "@/components/layout/container"
import { Section } from "@/components/layout/section"
import { SectionHeading } from "@/components/ui/section-heading"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "List Your Business | The BLACQList",
  description:
    "Your BLACQList Page is more than a directory listing — it's your digital headquarters. Tell your story. Showcase your services. Get discovered.",
}

const WHAT_YOU_GET = [
  {
    title: "A Professional Business Profile",
    body: "Cover photo, logo, your story, and a services menu — all on one page that looks as good as you are.",
  },
  {
    title: "Hours, Contact & Social Media",
    body: "Give your customers everything they need to find you, call you, and follow you — without leaving your page.",
  },
  {
    title: "Community Reviews & Verification",
    body: "Earn trust through authentic community reviews and our tiered verification system — from Claimed to Certified.",
  },
  {
    title: "Analytics That Matter",
    body: "See who's finding your page, how they found you, and what they're looking at — so you can grow smarter.",
  },
]

export default function ForBusinessPage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-deep-bg" aria-labelledby="for-business-heading">
        <Container className="py-16 md:py-24">
          <p className="font-subhead text-amber-gold text-xs uppercase tracking-[0.2em] mb-3">
            For Business Owners
          </p>
          <h1
            id="for-business-heading"
            className="font-headline text-4xl md:text-5xl text-white leading-tight mb-4"
          >
            You deserve a better page.
          </h1>
          <p className="font-subhead text-pale-lavender text-lg md:text-xl leading-relaxed max-w-xl mb-8">
            Your BLACQList Page is your digital headquarters — tell your story,
            showcase your services, and get found by the community that wants
            to support you.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              asChild
              className="bg-amber-gold text-brand-black font-body font-bold hover:bg-light-gold rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <Link href="/add-business">List Your Business Free</Link>
            </Button>
            <Button
              asChild
              className="border border-white/40 text-white bg-transparent hover:bg-white/10 rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <Link href="/claim">Claim an Existing Page</Link>
            </Button>
          </div>
        </Container>
      </section>

      {/* What you get */}
      <Section variant="white">
        <SectionHeading subtitle="Everything a Black-owned business deserves — visibility, trust, and community.">
          What You Get on The BLACQList
        </SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {WHAT_YOU_GET.map((item) => (
            <div
              key={item.title}
              className="rounded-lg border border-pale-lavender p-6"
            >
              <h3 className="font-headline text-base text-brand-black mb-2">
                {item.title}
              </h3>
              <p className="font-subhead text-sm text-charcoal leading-relaxed">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* Trust tiers */}
      <Section variant="cream">
        <SectionHeading subtitle="Not all listings are equal. The BLACQList trust tier system gives community members confidence and gives verified businesses a competitive edge.">
          Built on Community Trust
        </SectionHeading>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-8">
          {[
            { tier: "Unclaimed", desc: "Listed but not yet managed by the owner." },
            { tier: "Claimed", desc: "Owner has verified their identity and taken control of the page." },
            { tier: "Verified", desc: "Business documentation confirmed. Community trust established." },
            { tier: "Certified", desc: "Top tier. Full documentation, reviews, and community standing." },
          ].map((t) => (
            <div
              key={t.tier}
              className="rounded-lg border border-pale-lavender bg-white p-4"
            >
              <p className="font-headline text-sm text-brand-black mb-1">{t.tier}</p>
              <p className="font-subhead text-xs text-charcoal leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section variant="deep-bg">
        <div className="max-w-xl">
          <SectionHeading
            onDark
            subtitle="Listing is always free. Paid tiers with advanced features and premium visibility are coming in V1."
          >
            Start for Free. Grow with the Community.
          </SectionHeading>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button
              asChild
              className="bg-amber-gold text-brand-black font-body font-bold hover:bg-light-gold rounded-full px-6 py-2.5 min-h-[44px] h-auto"
            >
              <Link href="/add-business">List Your Business</Link>
            </Button>
            <Button
              asChild
              className="border border-white/40 text-white bg-transparent hover:bg-white/10 rounded-full px-6 py-2.5 min-h-[44px] h-auto"
            >
              <Link href="/pricing">See Pricing</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  )
}
