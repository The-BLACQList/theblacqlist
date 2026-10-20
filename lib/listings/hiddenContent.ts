import { capList, shownLimits, type HiddenCount } from '@/lib/stripe/downgrade'
import { isCreatorGroup } from '@/lib/listings/creatorAttributes'

// Ticket 105. What the owner's editor marks as hidden after a move to a lower
// plan. The public page read (lib/listings/entityPage.ts) applies the same
// caps in the same order, so what the editor tags is what the page leaves out.
// Client-safe and pure.

export interface HiddenContentInput {
  tier: string | null
  peakTier: string | null
  description: string | null
  /** Gallery photos in display order. Only approved ones show on the page, so only they count. */
  media: readonly { id: string; is_approved?: boolean | null }[]
  /** Videos in the owner's order. */
  videos: readonly { id: string }[]
  /** Common questions in display order. */
  faqs: readonly { id: string; question?: string | null; answer?: string | null }[]
  attributeGroups: readonly { slug: string; values: readonly { id: string }[] }[]
  selectedValueIds: readonly string[]
}

export interface HiddenContent {
  /** One entry per kind with something hidden, for the notice. */
  counts: HiddenCount[]
  /** Photo, video and question ids the page leaves out, for per-item tags. */
  hiddenIds: Set<string>
}

export function hiddenContent(input: HiddenContentInput): HiddenContent {
  const caps = shownLimits(input.tier, input.peakTier)
  const counts: HiddenCount[] = []
  const hiddenIds = new Set<string>()

  function list(
    kind: HiddenCount['kind'],
    items: readonly { id: string }[],
    limit: number | null
  ): void {
    if (limit === null) return
    const { hidden } = capList(items, limit)
    if (hidden.length === 0) return
    counts.push({ kind, hidden: hidden.length, limit })
    for (const item of hidden) hiddenIds.add(item.id)
  }

  list(
    'photos',
    input.media.filter((m) => m.is_approved === true),
    caps.photos
  )
  list('videos', input.videos, caps.videos)
  list(
    'faqs',
    input.faqs.filter((f) => f.question && f.answer),
    caps.faqs
  )

  if (caps.attributes !== null) {
    const counted = new Set(
      input.attributeGroups
        .filter((g) => !isCreatorGroup(g.slug))
        .flatMap((g) => g.values.map((v) => v.id))
    )
    const picked = input.selectedValueIds.filter((id) => counted.has(id)).length
    if (picked > caps.attributes) {
      counts.push({ kind: 'attributes', hidden: picked - caps.attributes, limit: caps.attributes })
    }
  }

  if (caps.descriptionChars !== null && (input.description ?? '').length > caps.descriptionChars) {
    counts.push({ kind: 'description', hidden: 1, limit: caps.descriptionChars })
  }

  return { counts, hiddenIds }
}
