import { EntityNowHiring, NowHiringView } from '@/components/entity-page/EntityNowHiring'
import type { EntityRenderMode } from '@/lib/entity-page/template'
import type { EntityPageData } from '@/types'

interface Props {
  entity: EntityPageData
  mode: EntityRenderMode
}

/**
 * "Now hiring" for the three business templates. Live pages keep the
 * flag-gated database read (ticket 154); the sample pages render the fixture's
 * roles straight through NowHiringView, because the jobs flag is off on
 * Preview and a sample page must not depend on it.
 */
export function EntityHiringBlock({ entity, mode }: Props) {
  if (mode === 'example') {
    if (!entity.hiring || entity.hiring.roles.length === 0) return null
    return (
      <NowHiringView
        businessId={entity.id}
        roles={entity.hiring.roles}
        total={entity.hiring.total}
      />
    )
  }
  return <EntityNowHiring listingId={entity.id} />
}
