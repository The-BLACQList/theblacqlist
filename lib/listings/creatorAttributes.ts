/**
 * Rules for the three creator filter groups (ticket 132).
 *
 * [Decision — founder, 2026-10-08] Creator niche, platform and audience tags
 * don't count toward the Free plan's 3-tag limit. Niche is capped at 3 so a
 * creator page stays findable by what it is really about, and audience size is
 * one self-reported range.
 *
 * The groups are `applies_to '{creator}'` (migration 20261008...creator_entity),
 * so other types never see them; `splitAttributePicks` also drops any that a
 * non-creator page sends. Pure and client-safe: the owner editor and the
 * server action share it.
 */

export const CREATOR_GROUP_SLUGS = ['creator-niche', 'creator-platforms', 'audience-size'] as const

/** Most values a creator may pick in a group. Groups not listed have no cap. */
export const CREATOR_GROUP_CAPS: Readonly<Record<string, number>> = {
  'creator-niche': 3,
  'audience-size': 1,
}

export function isCreatorGroup(groupSlug: string): boolean {
  return (CREATOR_GROUP_SLUGS as readonly string[]).includes(groupSlug)
}

/** The plain-language message when a group is over its cap. */
export function creatorCapMessage(groupSlug: string): string {
  return groupSlug === 'audience-size' ? 'Pick one audience size.' : 'Pick up to 3 niches.'
}

export interface AttributePick {
  id: string
  groupSlug: string
}

export interface SplitPicks {
  /** The picks to save. */
  kept: AttributePick[]
  /** How many of `kept` count toward the plan's tag limit. */
  planCount: number
  /** The first cap a creator went over, or null. */
  problem: string | null
}

export function splitAttributePicks(
  picks: readonly AttributePick[],
  entityType: string | null | undefined
): SplitPicks {
  const creator = entityType === 'creator'
  const kept = creator ? [...picks] : picks.filter((p) => !isCreatorGroup(p.groupSlug))

  let problem: string | null = null
  if (creator) {
    for (const [slug, cap] of Object.entries(CREATOR_GROUP_CAPS)) {
      if (kept.filter((p) => p.groupSlug === slug).length > cap) {
        problem = creatorCapMessage(slug)
        break
      }
    }
  }

  return {
    kept,
    planCount: kept.filter((p) => !isCreatorGroup(p.groupSlug)).length,
    problem,
  }
}

export interface CreatorChecklistInput {
  attributeGroups: readonly { slug: string; values: readonly { id: string }[] }[]
  selectedValueIds: readonly string[]
  videoEmbedUrl: string | null
  videoPath: string | null
  links: readonly unknown[]
}

/** The creator-only checklist facts, from what the finish view already loads. */
export function creatorChecklistFacts(page: CreatorChecklistInput): {
  nicheCount: number
  hasSample: boolean
} {
  const niche = page.attributeGroups.find((g) => g.slug === 'creator-niche')
  const nicheIds = new Set(niche?.values.map((v) => v.id) ?? [])
  return {
    nicheCount: page.selectedValueIds.filter((id) => nicheIds.has(id)).length,
    hasSample: !!(page.videoEmbedUrl || page.videoPath || page.links.length > 0),
  }
}
