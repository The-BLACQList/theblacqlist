'use client'

import { useState } from 'react'
import type { EntityPageData } from '@/types'

interface Props {
  entity: EntityPageData
}

export function EntityStorySection({ entity }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { description } = entity.details

  if (!description?.trim()) return null

  const paragraphs = description.split('\n\n').filter(Boolean)
  const isLong = description.length > 400

  // Split: first paragraph always visible; rest behind "Read more"
  const visibleParagraphs = expanded ? paragraphs : paragraphs.slice(0, 1)
  const hasMore = isLong && paragraphs.length > 1

  return (
    <section aria-labelledby="story-heading" className="bg-cream py-12 md:py-16">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
        <div className="md:max-w-2xl">
          <h2
            id="story-heading"
            className="font-headline text-[22px] md:text-[28px] text-brand-black mb-6"
          >
            Our Story
          </h2>

          <div className="flex flex-col gap-4">
            {visibleParagraphs.map((para, i) => {
              // First paragraph gets the amber left-border "origin story" treatment
              const isFirst = i === 0
              return isFirst ? (
                <blockquote
                  key={i}
                  className="border-l-4 border-amber-gold pl-4 font-body text-base text-charcoal leading-relaxed"
                >
                  {para}
                </blockquote>
              ) : (
                <p key={i} className="font-body text-base text-charcoal leading-relaxed">
                  {para}
                </p>
              )
            })}
          </div>

          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-4 font-subhead text-sm font-semibold text-amber hover:text-light-gold underline underline-offset-2 transition-colors"
              aria-expanded={expanded}
            >
              {expanded ? 'Read less' : 'Read more'}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
