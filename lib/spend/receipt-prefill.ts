// =============================================================================
// "I shopped here" prefill (ticket 162)
// =============================================================================
// A business page links to /account/receipts/new?listing=<id>. The id comes
// from a URL anyone can edit, so it is checked here before it reaches a query,
// and anything that isn't a plain UUID prefills nothing.
// =============================================================================

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Entity types a receipt can't be for: nobody shops at an event or a job. */
export const NON_SHOPPABLE_ENTITY_TYPES = ['event', 'job'] as const

/** The `?listing=` value as a listing id, or null when it isn't one. */
export function parseListingParam(value: string | string[] | undefined): string | null {
  // A repeated param is ambiguous, so it prefills nothing rather than guessing.
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return UUID.test(trimmed) ? trimmed.toLowerCase() : null
}

/** Whether a business page shows the "I shopped here" button. */
export function showShoppedHere({
  signedIn,
  entityType,
  collectiveOpen,
}: {
  signedIn: boolean
  entityType: string
  collectiveOpen: boolean
}): boolean {
  return (
    signedIn &&
    collectiveOpen &&
    !(NON_SHOPPABLE_ENTITY_TYPES as readonly string[]).includes(entityType)
  )
}
