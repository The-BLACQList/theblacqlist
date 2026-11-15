// One price wording for every place a marketplace item shows: the marketplace
// cards and the Shop section on the business's own page (ticket 186).
// null means the owner gave no price; each caller picks its own fallback.

/** Whole dollars, as the marketplace cards have always shown them: "$19". */
export function formatPriceCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

export function productPriceLabel(p: {
  price_display_text: string | null
  price_cents: number | null
}): string | null {
  if (p.price_display_text) return p.price_display_text
  return p.price_cents ? formatPriceCents(p.price_cents) : null
}

export function servicePriceLabel(s: {
  price_display_text: string | null
  starting_price_cents: number | null
}): string | null {
  if (s.price_display_text) return s.price_display_text
  return s.starting_price_cents != null
    ? `Starting at ${formatPriceCents(s.starting_price_cents)}`
    : null
}
