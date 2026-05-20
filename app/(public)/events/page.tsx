import Link from "next/link"
import type { Metadata } from "next"

import { Section } from "@/components/layout/section"
import { SectionHeading } from "@/components/ui/section-heading"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Events | The BLACQList",
  description:
    "Discover pop-ups, networking events, markets, and cultural experiences hosted by and for the Black community.",
}

export default function EventsPage() {
  return (
    <>
      <Section variant="pale-lavender">
        <PageHeader
          title="BLACQList Events"
          subtitle="Pop-ups, markets, networking nights, and cultural experiences — hosted by and for the community."
        />
      </Section>

      <Section variant="white">
        <span className="inline-block rounded-full border border-amber-gold text-amber-gold text-xs font-subhead font-semibold px-3 py-1 mb-5">
          Beta Feature
        </span>
        <SectionHeading subtitle="Events will let business owners post upcoming experiences and let community members find what's happening in their city.">
          Events Launching in Beta
        </SectionHeading>
        <p className="font-subhead text-sm text-charcoal mt-4 max-w-xl">
          From vendor markets to networking dinners, The BLACQList events
          calendar will become the go-to source for Black community events
          across the country. Business owners will be able to list events
          directly from their BLACQList Page.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Button
            asChild
            className="bg-brand-black text-white font-body font-bold hover:bg-charcoal rounded-full px-6 py-2.5 min-h-[44px] h-auto"
          >
            <Link href="/sign-up">Get Notified at Launch</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-brand-black text-brand-black font-body font-bold rounded-full px-6 py-2.5 min-h-[44px] h-auto"
          >
            <Link href="/for-business">List Your Business</Link>
          </Button>
        </div>
      </Section>
    </>
  )
}
