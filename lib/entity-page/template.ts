import type { EntityPageData } from '@/types'

/**
 * The props every listing template takes. One shape for all five — a template
 * is free to ignore what it does not need (JobTemplate reads neither `userId`
 * nor the review flags, because jobs are not reviewable), but the page renders
 * them all through the same call and does not special-case any of them.
 *
 * The type → template mapping itself lives in
 * `components/entity-page/templates/EntityTemplateOutlet.tsx`, which is where
 * the exhaustiveness check over `EntityType` sits.
 */
export interface EntityTemplateProps {
  entity: EntityPageData
  initialSaved: boolean
  userId: string | null
  isOwner: boolean
  hasReviewed: boolean
}
