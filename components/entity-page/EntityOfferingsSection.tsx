"use client"

import { useState } from "react"
import type { EntityPageData } from "@/types"

const VISIBLE_COUNT = 6

interface Props {
  entity: EntityPageData
}

export function EntityOfferingsSection({ entity }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { services } = entity.details

  if (!services || services.length === 0) return null

  const visibleServices = expanded ? services : services.slice(0, VISIBLE_COUNT)
  const hasMore = services.length > VISIBLE_COUNT

  return (
    <section
      aria-labelledby="offerings-heading"
      className="bg-white py-12 md:py-16"
    >
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <h2
          id="offerings-heading"
          className="font-headline text-[22px] md:text-[28px] text-brand-black mb-8"
        >
          Services &amp; Offerings
        </h2>

        <div
          className="divide-y divide-charcoal/10"
          aria-label="Services list"
        >
          {visibleServices.map((service) => (
            <div
              key={service.id}
              className="flex items-start justify-between gap-4 py-4 first:pt-0"
            >
              <div className="flex-1 min-w-0">
                <p className="font-subhead text-sm font-semibold text-brand-black mb-0.5">
                  {service.name}
                </p>
                {service.description && (
                  <p className="font-body text-sm text-charcoal leading-relaxed">
                    {service.description}
                  </p>
                )}
              </div>
              {service.price && (
                <p className="flex-shrink-0 font-subhead text-sm font-semibold text-brand-black text-right min-w-[80px]">
                  {service.price}
                </p>
              )}
            </div>
          ))}
        </div>

        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-6 font-subhead text-sm font-semibold text-amber-gold hover:text-light-gold underline underline-offset-2 transition-colors"
            aria-expanded={expanded}
          >
            {expanded
              ? "Show fewer services"
              : `Show all ${services.length} services`}
          </button>
        )}
      </div>
    </section>
  )
}
