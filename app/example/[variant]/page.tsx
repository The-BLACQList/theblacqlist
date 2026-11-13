import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { IS_PRODUCTION } from '@/lib/env'
import { buildJsonLd } from '@/lib/listings/jsonLd'
import { HappeningNowBanner } from '@/components/entity-page/HappeningNowBanner'
import { SectionMark } from '@/components/entity-page/SectionMark'
import { EntityTemplateOutlet } from '@/components/entity-page/templates/EntityTemplateOutlet'
import { ExampleBanner } from '@/components/example/ExampleBanner'
import {
  EXAMPLE_NAME,
  EXAMPLE_VARIANT_LABEL,
  buildExampleEntity,
  isExampleVariant,
} from '@/lib/example/fixtures'

// Rendered per request: the fixture's dates are relative to the visit, and
// the production check reads the deployment's environment.
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ variant: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { variant } = await params
  if (IS_PRODUCTION || !isExampleVariant(variant)) {
    return { title: 'Page not found' }
  }
  return {
    title: `Sample page: ${EXAMPLE_NAME} (${EXAMPLE_VARIANT_LABEL[variant]})`,
    description: `What a fully filled Premium ${EXAMPLE_VARIANT_LABEL[variant].toLowerCase()} page looks like on The BLACQList. A sample, not a real business.`,
  }
}

/**
 * "Test Business 123": one sample page per template with every Premium
 * feature filled, built from the fixtures in lib/example/fixtures (ticket
 * 184). Preview and staging only — production answers 404 — and nothing on it
 * writes anywhere: no page-view or post-view event, no tour witness, no quick-action bar,
 * no message composer, and the templates run in example mode, which holds
 * Save and Share and reads images from /images/example.
 *
 * The page carries the same LocalBusiness JSON-LD a live listing emits, so a
 * Preview URL can go straight into Google's Rich Results test. Its `url`
 * points at where the listing would live if it were real.
 *
 * Main's Happening now band (part F) renders above the template from
 * `entity.happeningNow`, as the live listing route does.
 */
export default async function ExampleVariantPage({ params }: PageProps) {
  if (IS_PRODUCTION) notFound()
  const { variant } = await params
  if (!isExampleVariant(variant)) notFound()

  const now = new Date()
  const entity = buildExampleEntity(variant, now)
  const jsonLd = buildJsonLd(entity, entity.entity_type)

  return (
    <div className="min-h-screen" data-example-variant={variant}>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ExampleBanner variant={variant} />
      {/* Registered but not ordered in the registry, like the nested marks:
          the route renders it, not the template. */}
      <SectionMark id="happening-now">
        <HappeningNowBanner posts={entity.happeningNow ?? []} now={now} />
      </SectionMark>
      <EntityTemplateOutlet
        key={entity.id}
        entity={entity}
        mode="example"
        initialSaved={false}
        userId={null}
        isOwner={false}
        hasReviewed={false}
      />
    </div>
  )
}
