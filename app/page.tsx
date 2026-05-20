import Link from "next/link"
import Image from "next/image"
import type { Metadata } from "next"

import { Container } from "@/components/layout/container"
import { Section } from "@/components/layout/section"
import { SectionHeading } from "@/components/ui/section-heading"
import { Button } from "@/components/ui/button"

export const revalidate = 3600

export const metadata: Metadata = {
  title: "Find & Be Found. | The BLACQList",
  description:
    "The national directory for Black-owned businesses — built by community, powered by culture. Discover, support, and connect across every city.",
}

const CATEGORIES = [
  { label: "Food & Dining" },
  { label: "Beauty & Wellness" },
  { label: "Retail & Shopping" },
  { label: "Professional Services" },
  { label: "Arts & Entertainment" },
  { label: "Health & Fitness" },
  { label: "Home & Living" },
  { label: "Technology" },
  { label: "Finance & Legal" },
  { label: "Education" },
  { label: "Events & Experiences" },
  { label: "Community & Nonprofits" },
]

const CITIES = [
  { label: "Atlanta", state: "GA" },
  { label: "New York", state: "NY" },
  { label: "Washington", state: "DC" },
  { label: "Houston", state: "TX" },
  { label: "Chicago", state: "IL" },
  { label: "Los Angeles", state: "CA" },
  { label: "Miami", state: "FL" },
  { label: "Philadelphia", state: "PA" },
  { label: "Detroit", state: "MI" },
  { label: "Charlotte", state: "NC" },
  { label: "Dallas", state: "TX" },
  { label: "Baltimore", state: "MD" },
]

const FEATURES = [
  {
    accent: "bg-amber-gold",
    title: "Discover",
    body: "Find Black-owned businesses near you and across the country. From your neighborhood café to the next city's hidden gem.",
  },
  {
    accent: "bg-pale-lavender",
    title: "Support",
    body: "Keep the dollar circulating in Black communities. Every purchase, review, and referral builds real economic power.",
  },
  {
    accent: "bg-deep-bg",
    title: "Connect",
    body: "Leave reviews, save your favorites, and share with your network. Your voice is what makes this community thrive.",
  },
]

const PAGE_FEATURES = [
  "Professional photos, your story, and a full services menu",
  "Hours, contact info, and social media — all in one place",
  "Community reviews and trust-tier verification",
]

export default function HomePage() {
  return (
    <>
      {/* ─── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative bg-deep-bg overflow-hidden" aria-labelledby="hero-heading">
        {/* Background photo — decorative, described by heading text */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero-bg.jpg"
            alt=""
            fill
            className="object-cover object-[center_20%]"
            priority
            sizes="100vw"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-deep-bg/90 via-deep-bg/70 to-deep-bg/40"
            aria-hidden="true"
          />
        </div>

        <Container className="relative z-10 py-28 md:py-40">
          <p className="font-subhead text-amber-gold text-xs uppercase tracking-[0.2em] mb-3">
            Atlanta-born. National from day one.
          </p>
          <h1
            id="hero-heading"
            className="font-headline text-5xl md:text-6xl lg:text-7xl text-white leading-[1.05] mb-4"
          >
            Find &amp; Be Found.
          </h1>
          <p className="font-subhead text-pale-lavender text-lg md:text-xl leading-relaxed max-w-xl mb-3">
            The national directory for Black-owned businesses — built by
            community, powered by culture.
          </p>
          <p className="font-body text-amber-gold text-base font-bold mb-10">
            Keep the dollar moving.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              asChild
              className="bg-amber-gold text-brand-black font-body font-bold hover:bg-light-gold rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <Link href="/discover">Explore Businesses</Link>
            </Button>
            <Button
              asChild
              className="border border-white/40 text-white bg-transparent hover:bg-white/10 rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <Link href="/sign-up">Join Free</Link>
            </Button>
          </div>
        </Container>
      </section>

      {/* ─── Feature trio ──────────────────────────────────────────────────── */}
      <Section variant="white" id="how-it-works">
        <SectionHeading
          align="center"
          subtitle="One platform. Every city. All Black-owned."
        >
          Discover. Support. Connect.
        </SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
          {FEATURES.map((card) => (
            <div
              key={card.title}
              className="rounded-lg border border-pale-lavender p-6"
            >
              <div
                className={`w-8 h-8 rounded-md ${card.accent} mb-4`}
                aria-hidden="true"
              />
              <h3 className="font-headline text-lg text-brand-black mb-2">
                {card.title}
              </h3>
              <p className="font-subhead text-sm text-charcoal leading-relaxed">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ─── Community CTA ─────────────────────────────────────────────────── */}
      <Section variant="cream" id="community">
        <div className="max-w-xl">
          <SectionHeading subtitle="From restaurants and salons to lawyers and tech companies — The BLACQList is your guide to the full spectrum of Black-owned businesses, in every city.">
            Find what you need. Support who matters.
          </SectionHeading>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button
              asChild
              className="bg-brand-black text-white font-body font-bold hover:bg-charcoal rounded-full px-6 py-2.5 min-h-[44px] h-auto"
            >
              <Link href="/discover">Start Exploring</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-brand-black text-brand-black font-body font-bold rounded-full px-6 py-2.5 min-h-[44px] h-auto"
            >
              <Link href="/discover">Browse by Category</Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* ─── Featured categories ───────────────────────────────────────────── */}
      <Section variant="pale-lavender" id="categories">
        <SectionHeading
          align="center"
          subtitle="Every industry. Every city."
        >
          Explore by Category
        </SectionHeading>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-8">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.label}
              href="/discover"
              className="flex items-center justify-center text-center rounded-lg border border-charcoal/20 bg-white px-4 py-3 font-subhead text-sm text-brand-black hover:border-amber-gold hover:bg-cream transition-colors min-h-[44px]"
            >
              {cat.label}
            </Link>
          ))}
        </div>
      </Section>

      {/* ─── City discovery ────────────────────────────────────────────────── */}
      <Section variant="white" id="cities">
        <div className="mb-8">
          <SectionHeading subtitle="We started in Atlanta. Now the network is growing nationwide — one city at a time.">
            Your city. Your community.
          </SectionHeading>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {CITIES.map((city) => (
            <Link
              key={`${city.label}-${city.state}`}
              href="/discover"
              className="flex flex-col items-start rounded-lg border border-pale-lavender bg-white px-4 py-3 hover:border-amber-gold hover:bg-cream transition-colors"
            >
              <span className="font-headline text-sm text-brand-black">
                {city.label}
              </span>
              <span className="font-subhead text-xs text-charcoal">
                {city.state}
              </span>
            </Link>
          ))}
        </div>
        <p className="font-subhead text-sm text-charcoal mt-5">
          More cities launching soon.{" "}
          <Link
            href="/sign-up"
            className="text-amber-gold underline underline-offset-2 hover:text-light-gold transition-colors"
          >
            Get notified when we reach your city.
          </Link>
        </p>
      </Section>

      {/* ─── BLACQList Pages explanation ───────────────────────────────────── */}
      <Section variant="deep-bg" id="blacqlist-pages">
        <div className="max-w-2xl">
          <SectionHeading
            onDark
            subtitle="More than a listing. A living business profile."
          >
            Your BLACQList Page
          </SectionHeading>
          <ul className="mt-6 space-y-3" aria-label="BLACQList Page features">
            {PAGE_FEATURES.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 font-subhead text-pale-lavender text-sm"
              >
                <span
                  className="mt-[5px] h-2 w-2 shrink-0 rounded-full bg-amber-gold"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <Button
              asChild
              className="bg-amber-gold text-brand-black font-body font-bold hover:bg-light-gold rounded-full px-6 py-2.5 min-h-[44px] h-auto"
            >
              <Link href="/for-business">Claim Your Page</Link>
            </Button>
            <Button
              asChild
              className="border border-white/40 text-white bg-transparent hover:bg-white/10 rounded-full px-6 py-2.5 min-h-[44px] h-auto"
            >
              <Link href="/for-business">List Your Business</Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* ─── For Business CTA ──────────────────────────────────────────────── */}
      <Section variant="cream" id="for-business">
        <div className="max-w-xl">
          <SectionHeading subtitle="Your BLACQList Page is your digital headquarters — tell your story, showcase your services, and get found by the community that wants to support you.">
            You deserve a better page.
          </SectionHeading>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button
              asChild
              className="bg-brand-black text-white font-body font-bold hover:bg-charcoal rounded-full px-6 py-2.5 min-h-[44px] h-auto"
            >
              <Link href="/for-business">List Your Business Free</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-brand-black text-brand-black font-body font-bold rounded-full px-6 py-2.5 min-h-[44px] h-auto"
            >
              <Link href="/for-business">See How It Works</Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* ─── Community spend / flow map teaser ────────────────────────────── */}
      <Section variant="brand-black" id="flow-map">
        <div className="max-w-2xl">
          <span className="inline-block rounded-full border border-amber-gold text-amber-gold text-xs font-subhead font-semibold px-3 py-1 mb-4">
            Coming Soon
          </span>
          <SectionHeading
            onDark
            subtitle="Track the flow of community dollars. See your personal economic impact. Watch the BLACQList network grow in real time."
          >
            Keep the dollar moving.
          </SectionHeading>
          <div className="mt-6">
            <Button
              asChild
              className="bg-amber-gold text-brand-black font-body font-bold hover:bg-light-gold rounded-full px-6 py-2.5 min-h-[44px] h-auto"
            >
              <Link href="/sign-up">Get Early Access</Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* ─── BLACQLight teaser ─────────────────────────────────────────────── */}
      <Section variant="pale-lavender" id="blacqlight">
        <div className="max-w-2xl">
          <span className="inline-block rounded-full border border-charcoal/30 text-charcoal text-xs font-subhead font-semibold px-3 py-1 mb-4">
            V1 Feature
          </span>
          <SectionHeading subtitle="A spotlight on the businesses, people, and movements shaping Black economic power. Stories that inspire. Profiles that matter.">
            Introducing BLACQLight
          </SectionHeading>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Button
              asChild
              className="bg-brand-black text-white font-body font-bold hover:bg-charcoal rounded-full px-6 py-2.5 min-h-[44px] h-auto"
            >
              <Link href="/sign-up">Get Notified</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-brand-black text-brand-black font-body font-bold rounded-full px-6 py-2.5 min-h-[44px] h-auto"
            >
              <Link href="/blacqlight">Learn More</Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* ─── Final CTA ─────────────────────────────────────────────────────── */}
      <Section variant="deep-bg" id="join">
        <div className="text-center max-w-xl mx-auto">
          <h2 className="font-headline text-3xl md:text-4xl text-white mb-3">
            Ready to Find &amp; Be Found?
          </h2>
          <p className="font-subhead text-pale-lavender text-base md:text-lg mb-8">
            Join the platform built to move money, grow community, and celebrate
            Black-owned excellence — in every city.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              asChild
              className="bg-amber-gold text-brand-black font-body font-bold hover:bg-light-gold rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <Link href="/for-business">List Your Business</Link>
            </Button>
            <Button
              asChild
              className="border border-white/40 text-white bg-transparent hover:bg-white/10 rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <Link href="/discover">Explore Businesses</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  )
}
