// =============================================================================
// Business names as shoppers and receipts write them
// =============================================================================
// One normalizer for every place that compares a typed or printed business
// name with another: the receipt read (ticket 163) matching a photo against
// listings, and the unlisted-business list (ticket 168) grouping receipts.
//
// "The Sweet Spot Bakery, LLC", "SWEET SPOT BAKERY" and "sweet-spot bakery #2"
// all become "sweet spot bakery". Lowercase, accents folded, & read as "and",
// punctuation and store numbers dropped, a leading "the" and trailing company
// words (llc, inc, co ...) removed, spaces collapsed.
// =============================================================================

const COMPANY_SUFFIXES = new Set(['llc', 'inc', 'incorporated', 'co', 'corp', 'corporation', 'ltd', 'pllc', 'llp'])

export function normalizeBusinessName(raw: string): string {
  const words = raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    // Store numbers: "#2", "no. 14", "store 0031".
    .replace(/#\s*\d+/g, ' ')
    .replace(/\b(?:no\.?|store)\s*\d+\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)

  if (words[0] === 'the' && words.length > 1) words.shift()
  while (words.length > 1 && COMPANY_SUFFIXES.has(words[words.length - 1]!)) words.pop()
  return words.join(' ')
}

/** The words of a normalized name, for overlap scoring. */
export function nameTokens(raw: string): string[] {
  return normalizeBusinessName(raw).split(' ').filter(Boolean)
}
