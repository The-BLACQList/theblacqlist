import { Reveal } from '@/components/motion/Reveal'
import { TemplateHero } from '@/components/entity-page/templates/TemplateHero'
import { EntityAnchorTabs, type AnchorTab } from '@/components/entity-page/templates/EntityAnchorTabs'
import { EntityJobDetails } from '@/components/entity-page/EntityJobDetails'
import { EntityMediaGallery } from '@/components/entity-page/EntityMediaGallery'
import { EntityRelatedDiscovery } from '@/components/entity-page/EntityRelatedDiscovery'
import type { EntityTemplateProps } from '@/lib/entity-page/template'

/**
 * Job archetype — `job`.
 *
 * Deliberately the plainest template in the set. A job posting is read once
 * and acted on; the hero is the shortest of the five and the page below it is
 * the details block, whatever photos the employer attached, and related work.
 *
 * **No reviews.** A job posting is not a reviewable thing
 * `[Decision — founder, 2026-09-02]`, which is why this template takes the
 * shared props shape but never reads `userId` / `isOwner` / `hasReviewed`.
 *
 * Like EventTemplate it has no Visit section, which `getCtaHref` relies on —
 * see the guard in `templates/cta.ts`.
 */
export function JobTemplate({ entity, initialSaved }: EntityTemplateProps) {
  const hasGallery = entity.images.length > 0

  const tabs: AnchorTab[] = [
    { id: 'details', label: 'Details' },
    ...(hasGallery ? [{ id: 'gallery', label: 'Photos' }] : []),
  ]

  return (
    <>
      <TemplateHero entity={entity} initialSaved={initialSaved} variant="job" />
      <EntityAnchorTabs tabs={tabs} />

      <div id="details" className="scroll-mt-32">
        <EntityJobDetails entity={entity} />
      </div>

      <div id="gallery" className="scroll-mt-32">
        <EntityMediaGallery entity={entity} images={entity.images} />
      </div>

      <Reveal>
        <EntityRelatedDiscovery entity={entity} />
      </Reveal>
    </>
  )
}
