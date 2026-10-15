export interface MoreFiltersInput {
  category: string
  prices: string[]
  locationTypes: string[]
  attrs: string[]
  trustTier: string
}

/**
 * How many filters are set inside the "More filters" group on Discover
 * (Category, Price, How to reach them, attribute groups, Trust Level).
 * Every picked value counts once, so two prices and an amenity read as 3.
 * Type, Ownership, City and Open now sit outside the group and are not counted.
 */
export function countMoreFilters(input: MoreFiltersInput): number {
  return (
    (input.category ? 1 : 0) +
    input.prices.length +
    input.locationTypes.length +
    input.attrs.length +
    (input.trustTier ? 1 : 0)
  )
}
