import { Fragment } from 'react'
import type { FactItem } from '@/lib/listings/facts'
import { cn } from '@/lib/utils'

interface Props {
  facts: FactItem[]
  className?: string
}

/**
 * "Est. 2014 · $$ · Takes reservations" under the name in the hero (ticket
 * 189). Rendered only when there is at least one fact; the price symbol gets
 * a spoken form so a screen reader does not read "dollar dollar".
 */
export function EntityFactsLine({ facts, className }: Props) {
  if (facts.length === 0) return null
  return (
    <p
      data-testid="facts-line"
      className={cn(
        'flex flex-wrap items-center gap-x-2 font-body text-sm md:text-[15px] text-off-white/90',
        className
      )}
    >
      {facts.map((fact, i) => (
        <Fragment key={fact.key}>
          {i > 0 && <span aria-hidden="true">·</span>}
          {fact.title ? (
            <span title={fact.title}>
              <span className="sr-only">Price range: {fact.title}</span>
              <span aria-hidden="true">{fact.label}</span>
            </span>
          ) : (
            <span>{fact.label}</span>
          )}
        </Fragment>
      ))}
    </p>
  )
}
