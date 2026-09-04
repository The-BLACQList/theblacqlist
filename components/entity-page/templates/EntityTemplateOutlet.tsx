import { StorefrontTemplate } from '@/components/entity-page/templates/StorefrontTemplate'
import { ProfessionalTemplate } from '@/components/entity-page/templates/ProfessionalTemplate'
import { CreativeTemplate } from '@/components/entity-page/templates/CreativeTemplate'
import { EventTemplate } from '@/components/entity-page/templates/EventTemplate'
import { JobTemplate } from '@/components/entity-page/templates/JobTemplate'
import type { EntityTemplateProps } from '@/lib/entity-page/template'

/**
 * The one place a listing type turns into a rendered page. Replaces the
 * four-way nested ternary and the hand-written `isEvent` / `isJob` /
 * `isProfessional` / `isCreative` booleans the listing page used to carry
 * (PR 6).
 *
 * Written as literal JSX branches rather than a `Record` lookup because
 * `react-hooks/static-components` refuses a component binding created during
 * render — and because the `never` assignment in `default` is a stronger
 * guarantee than a map: adding a ninth type to `VALID_ENTITY_TYPES` without
 * deciding how it renders is a typecheck failure here, not a listing that
 * silently falls through to whatever the last branch happened to be.
 *
 * `service_provider` is a legacy alias for `professional`; both land on the
 * same template. The storefront return in `default` is defence against a
 * hand-written row whose `entity_type` escaped the column's CHECK constraint,
 * not an expected path.
 */
export function EntityTemplateOutlet(props: EntityTemplateProps) {
  switch (props.entity.entity_type) {
    case 'business':
    case 'restaurant':
    case 'vendor':
      return <StorefrontTemplate {...props} />
    case 'professional':
    case 'service_provider':
      return <ProfessionalTemplate {...props} />
    case 'creative':
      return <CreativeTemplate {...props} />
    case 'event':
      return <EventTemplate {...props} />
    case 'job':
      return <JobTemplate {...props} />
    default: {
      const unhandled: never = props.entity.entity_type
      void unhandled
      return <StorefrontTemplate {...props} />
    }
  }
}
