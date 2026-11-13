import type { BusinessDetails, PriceRange } from '@/types'

/**
 * The facts line under a business's name (ticket 189): "Est. 2014 · $$ ·
 * Takes reservations", only the facts the owner filled. Pure, so the hero,
 * the section registry and the tests read one rule.
 */
export interface FactItem {
  key: 'founded' | 'price' | 'reservations'
  /** What the page shows. */
  label: string
  /** Spoken form when the label is a symbol ("$$" → "Moderate prices"). */
  title?: string
}

export const PRICE_RANGE_TITLE: Record<PriceRange, string> = {
  $: 'Budget-friendly',
  $$: 'Moderate prices',
  $$$: 'Higher-end prices',
  $$$$: 'Premium prices',
}

type FactSource = Pick<BusinessDetails, 'founded_year' | 'price_range' | 'accepts_reservations'>

export function factsFor(details: FactSource): FactItem[] {
  const facts: FactItem[] = []
  if (details.founded_year != null) {
    facts.push({ key: 'founded', label: `Est. ${details.founded_year}` })
  }
  if (details.price_range != null) {
    facts.push({
      key: 'price',
      label: details.price_range,
      title: PRICE_RANGE_TITLE[details.price_range],
    })
  }
  if (details.accepts_reservations === true) {
    facts.push({ key: 'reservations', label: 'Takes reservations' })
  } else if (details.accepts_reservations === false) {
    facts.push({ key: 'reservations', label: 'Walk-ins only' })
  }
  return facts
}
