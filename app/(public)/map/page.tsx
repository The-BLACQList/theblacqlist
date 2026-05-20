import Link from "next/link"
import type { Metadata } from "next"

import { Section } from "@/components/layout/section"
import { SectionHeading } from "@/components/ui/section-heading"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Business Map | The BLACQList",
  description:
    "See Black-owned businesses plotted near you and across the country. Explore your neighborhood, your city, and beyond.",
}

export default function MapPage() {
  return (
    <>
      <Section variant="pale-lavender">
        <PageHeader
          title="Business Map"
          subtitle="See Black-owned businesses near you and across the country — plotted on a live, interactive map."
        />
      </Section>

      <Section variant="white">
        <span className="inline-block rounded-full border border-charcoal/30 text-charcoal text-xs font-subhead font-semibold px-3 py-1 mb-5">
          V2 Feature
        </span>
        <SectionHeading subtitle="The BLACQList map lets you explore by location — find what's around the corner or plan your visit to another city.">
          Map View Coming in V2
        </SectionHeading>
        <p className="font-subhead text-sm text-charcoal mt-4 max-w-xl">
          The interactive business map is planned for V2 with full location
          search, category filtering, and city-level exploration. In the
          meantime, browse the directory or search by city.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Button
            asChild
            className="bg-brand-black text-white font-body font-bold hover:bg-charcoal rounded-full px-6 py-2.5 min-h-[44px] h-auto"
          >
            <Link href="/discover">Browse the Directory</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-brand-black text-brand-black font-body font-bold rounded-full px-6 py-2.5 min-h-[44px] h-auto"
          >
            <Link href="/sign-up">Get Notified at Launch</Link>
          </Button>
        </div>
      </Section>
    </>
  )
}
