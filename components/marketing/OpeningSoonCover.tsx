import Link from 'next/link'

import { NodeConstellation } from '@/components/brand/NodeConstellation'
import { Container } from '@/components/layout/container'
import { Section } from '@/components/layout/section'
import { Button } from '@/components/ui/button'
import { LaunchWaitlist } from '@/components/marketing/LaunchWaitlist'
import type { SoonFeatureConfig } from '@/lib/features/opening-soon'

// The page people see in place of a feature that isn't open yet (ticket 122).
// proxy.ts rewrites the feature's routes here, so this renders at whatever
// address they followed. It says what is coming, takes an email, and points at
// the part of the site that is open.

interface Props {
  feature: SoonFeatureConfig
}

export function OpeningSoonCover({ feature }: Props) {
  const waitlistId = `${feature.source}-waitlist`

  return (
    <>
      <section
        className="relative isolate overflow-hidden bg-deep-bg"
        aria-labelledby="opening-soon-heading"
      >
        <NodeConstellation
          variant="still"
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 opacity-25"
          style={{ width: 'min(140vw, 760px)' }}
        />
        <Container className="py-16 md:py-24">
          <p className="font-subhead text-gold text-xs uppercase tracking-[0.2em] mb-3">
            Opening soon
          </p>
          <h1
            id="opening-soon-heading"
            className="font-headline text-4xl md:text-5xl text-white leading-tight mb-4 text-balance"
          >
            {feature.name} isn&apos;t open yet.
          </h1>
          <p className="font-subhead text-pale-lavender text-lg leading-relaxed max-w-xl mb-8">
            {feature.blurb}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              asChild
              className="bg-amber-gold text-brand-black font-body font-bold hover:bg-light-gold rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <Link href={`#${waitlistId}`}>Tell me when it opens</Link>
            </Button>
            <Button
              asChild
              className="border border-white/40 text-white bg-transparent hover:bg-white/10 rounded-full px-7 py-3 text-base min-h-[48px] h-auto"
            >
              <Link href="/discover">Browse the list</Link>
            </Button>
          </div>
        </Container>
      </section>

      <Section variant="white">
        <span className="inline-block rounded-full border border-charcoal/30 text-charcoal text-xs font-subhead font-semibold px-3 py-1 mb-5">
          Not open yet
        </span>
        <h2 className="font-headline text-2xl md:text-3xl text-brand-black mb-4">
          What it will do
        </h2>
        <ul className="space-y-2 font-subhead text-charcoal max-w-xl">
          {feature.points.map((point) => (
            <li key={point} className="flex gap-3">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-gold" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <p className="font-subhead text-sm text-charcoal mt-6 max-w-xl">
          We&apos;re still building it. Leave your email and we&apos;ll tell you the day it opens.
          Nothing else.
        </p>
        <LaunchWaitlist
          options={[{ value: feature.source, label: feature.name }]}
          id={waitlistId}
          submitLabel="Tell me when it opens"
          successMessage={`You're on the list. We'll email you the day ${feature.name} opens.`}
        />
      </Section>
    </>
  )
}
