import type { EntityPageData } from '@/types'

/**
 * How a template is being rendered (ticket 184).
 *   live     a real listing on its public URL. The default; nothing changes.
 *   example  the "Test Business 123" sample pages under /example. Save, Share,
 *            Message and contact links look the same but do nothing; images
 *            may come from /images/example; sections that the live loader
 *            cannot fill yet render from the fixture.
 * Ticket 188 adds 'edit' for the click-to-fill owner editor.
 */
export type EntityRenderMode = 'live' | 'example'

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
  /** Defaults to 'live'. See EntityRenderMode. */
  mode?: EntityRenderMode
}
