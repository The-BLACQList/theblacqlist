import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'

import { Section } from '@/components/layout/section'
import { SectionHeading } from '@/components/ui/section-heading'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'About | The BLACQList',
  description:
    'We started in Atlanta with a simple belief: Black-owned businesses deserve better tools and more visibility. Today, that belief is a national platform.',
}

const PILLARS = [
  {
    title: 'Discovery with Depth',
    body: 'Not just a list of names — full business profiles that tell the story behind each venture.',
  },
  {
    title: 'Community Trust',
    body: 'A verification system built on real documentation and community reviews, not pay-to-play badges.',
  },
  {
    title: 'Economic Circulation',
    body: 'Tools that help dollars move through Black communities — and show the impact in real time.',
  },
  {
    title: 'Cultural Specificity',
    body: 'Built for Black-owned businesses specifically, not adapted from a generic directory.',
  },
]

export default function AboutPage() {
  return (
    <>
      {/* Photographic hero — photographic-style-direction.md Priority 5. Mirrors
          the shipped HomeHero pattern: fill image, dark-left gradient, text over.
          alt="" because the h1 immediately beneath carries the context and the
          photo is editorial, not a depiction of a specific business. */}
      <section
        aria-labelledby="about-heading"
        className="relative min-h-[340px] md:min-h-[420px] flex items-end"
      >
        <Image
          src="/images/editorial/afrofuturist-bookshop.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[70%_center]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, rgba(4,4,5,0.88) 0%, rgba(4,4,5,0.66) 55%, rgba(4,4,5,0.34) 100%)',
          }}
          aria-hidden="true"
        />
        <div className="relative z-10 max-w-7xl mx-auto w-full px-5 md:px-8 lg:px-10 py-14 md:py-16">
          <h1
            id="about-heading"
            className="font-headline text-3xl md:text-5xl font-bold text-white leading-tight text-balance max-w-[18ch]"
          >
            About The BLACQList
          </h1>
          <p className="font-subhead text-base md:text-lg text-off-white/90 mt-3 max-w-[46ch]">
            Atlanta-born. National from day one. Community-powered everywhere.
          </p>
        </div>
      </section>

      <Section variant="white">
        <div className="max-w-2xl">
          <SectionHeading subtitle="2024 · Atlanta, Georgia">Where We Started</SectionHeading>
          <div className="mt-4 space-y-4 font-subhead text-base text-charcoal leading-relaxed">
            <p>
              We started with a simple observation: Black-owned businesses were everywhere, but
              finding them — reliably, completely, with full context — was harder than it should be.
            </p>
            <p>
              Generic directories weren&apos;t built with us in mind. Social media pages came and
              went. Word of mouth couldn&apos;t scale. The tools existed, but they weren&apos;t
              ours.
            </p>
            <p>
              The BLACQList is the platform we built to fix that. A national directory with the
              depth and trust that Black-owned businesses deserve, and the discovery experience that
              Black consumers have always needed.
            </p>
          </div>
        </div>
      </Section>

      {/* Inline pull photo — the second half of Priority 5. A full-bleed band
          between the origin story and the principles; decorative, so alt="". */}
      <div className="relative w-full aspect-[3/1] md:aspect-[4/1] bg-deep-bg">
        <Image
          src="/images/editorial/sable-fitness-collective.webp"
          alt=""
          fill
          loading="lazy"
          sizes="100vw"
          className="object-cover object-[center_35%]"
        />
      </div>

      <Section variant="cream">
        <SectionHeading subtitle="Four principles guide every decision we make.">
          What We Stand For
        </SectionHeading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {PILLARS.map((pillar) => (
            <div key={pillar.title} className="rounded-lg border border-pale-lavender bg-white p-6">
              <h3 className="font-headline text-base text-brand-black mb-2">{pillar.title}</h3>
              <p className="font-subhead text-sm text-charcoal leading-relaxed">{pillar.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section variant="white">
        <div className="max-w-2xl">
          <SectionHeading subtitle="Our editorial focus, clearly stated.">
            Who We Feature
          </SectionHeading>
          <div className="mt-4 space-y-4 font-subhead text-base text-charcoal leading-relaxed">
            <p>
              The BLACQList is an editorial directory built to center and elevate Black-owned
              businesses. Every listing is clearly labeled so you always know exactly who
              you&rsquo;re supporting.
            </p>
            <p>
              <strong>Black-Owned</strong> means a business in which Black or African American
              individual(s) hold majority ownership (&ge;51%) and exercise meaningful operational
              control or management authority. Black-owned businesses are what the platform is
              built around — they are featured first across the directory.
            </p>
            <p>
              <strong>Ally</strong> means a business that supports Black-owned businesses and the
              community but is not itself majority Black-owned. Allies are welcome and always
              clearly labeled — never presented as Black-owned.
            </p>
            <p>
              How we present and prioritize listings is an editorial judgment — the same way a
              publication decides what to cover and what to feature. This is what keeps the
              directory trustworthy for the community it was built to serve.
            </p>
          </div>
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
