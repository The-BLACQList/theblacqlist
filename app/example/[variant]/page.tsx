import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { IS_PRODUCTION } from '@/lib/env'
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
 * writes anywhere: no page-view event, no tour witness, no quick-action bar,
 * no message composer, and the templates run in example mode, which holds
 * Save and Share and reads images from /images/example.
 */
export default async function ExampleVariantPage({ params }: PageProps) {
  if (IS_PRODUCTION) notFound()
  const { variant } = await params
  if (!isExampleVariant(variant)) notFound()

  const entity = buildExampleEntity(variant, new Date())

  return (
    <div className="min-h-screen" data-example-variant={variant}>
      <ExampleBanner variant={variant} />
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
