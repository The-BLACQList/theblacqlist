// =============================================================================
// Coming-soon page copy (pre-launch R1, R3, R4)
// =============================================================================
// VERBATIM from the marketing OS. Do not edit wording here; change the source,
// have it re-approved, then copy it across.
//
//   Page sections 1 to 11 and the confirmation state:
//     run_20261002_36bd2a/outputs/capture.md, sections 3 and 6
//   "Which describes you?" field, its options and its purpose line:
//     run_20261002_36bd2a/outputs/qualification.md, section 6
//     (capture.md R3 has an earlier "I'm here to discover"; qualification.md is
//     the later, specific request and is what the operator brief names)
//
//   supporterLine (and the retired allyLine field):
//     projects/theblacqlist/08_content/REFRESH_PLAN.md (v2 copy, WF-057
//     run_20261004_ff06c3), which supersedes capture.md for these two fields
//
// Straight apostrophes are kept as written in the sources.
// =============================================================================

export const COMING_SOON_COPY = {
  name: 'The BLACQList',
  headline: 'Find & Be Found.',
  supporterLine:
    'Black-owned businesses, front and center, across six cities. The BLACQList opens soon. Join the launch list to hear first.',
  cta: 'Join the launch list',
  ownerLine:
    'Own a business in Atlanta, Chicago, Houston, Los Angeles, New Orleans or DC? It may already have a Page on The BLACQList. Join the list to be the first to know when you can claim it, free.',
  ownerFallback: "Not listed yet? You'll be able to create your Page, free.",
  instagramFollow: 'Follow @theblacqlist',
} as const

/**
 * Consent line. The capture.md draft ("We'll email you when The BLACQList opens
 * and during launch. Unsubscribe anytime.") waits on Business Operations (open
 * question Q2) and is NOT approved, so the page keeps its current wording here
 * until it is. Do not invent legal wording.
 */
// Consent wording pending Business Operations (R7)
export const CONSENT_LINE_CURRENT =
  "Drop your email and we'll let you know the moment we go live."

export const ROLE_FIELD_COPY = {
  legend: 'Which describes you?',
  purpose: 'So we send you the emails that fit.',
  owner: 'I own a business',
  supporter: "I'm here to find businesses",
} as const

export const CONFIRMATION_COPY = {
  title: "You're on the list.",
  body: "We'll email you when The BLACQList opens.",
  /** Replaces `body` when the person chose "I own a business". */
  ownerBody: "We'll let you know when you can claim or create your Page.",
  share:
    'Know someone who should be here, a business owner or a friend? Send them to theblacqlist.com.',
  follow: "Follow @theblacqlist for the businesses we're getting ready to show you.",
} as const

export const INSTAGRAM_URL = 'https://www.instagram.com/theblacqlist/'

// ── Owner headline (section 6) ───────────────────────────────────────────────
// Pending WF-020 positioning_approval. Until it is approved the page ships
// without this row (capture.md: "ship the page without this row, with section
// 7 on its own"). COMING_SOON_OWNER_HEADLINE picks it at request time:
//   a    -> "You deserve a better page."
//   b    -> "Your Black-owned business deserves a better Page."
//   off  -> no headline (default, and for any other value)
export const OWNER_HEADLINES = {
  a: 'You deserve a better page.',
  b: 'Your Black-owned business deserves a better Page.',
} as const
export type OwnerHeadlineVariant = keyof typeof OWNER_HEADLINES

export function resolveOwnerHeadline(
  value: string | undefined = process.env.COMING_SOON_OWNER_HEADLINE
): string | null {
  const key = value?.trim().toLowerCase()
  return key === 'a' || key === 'b' ? OWNER_HEADLINES[key] : null
}
