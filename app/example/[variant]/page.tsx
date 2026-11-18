import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { IS_PRODUCTION } from '@/lib/env'
import { buildJsonLd } from '@/lib/listings/jsonLd'
import { HappeningNowBanner } from '@/components/entity-page/HappeningNowBanner'
import { SectionMark } from '@/components/entity-page/SectionMark'
import { EntityTemplateOutlet } from '@/components/entity-page/templates/EntityTemplateOutlet'
import { ExampleBanner } from '@/components/example/ExampleBanner'
import { ChaptersPage } from '@/components/entity-page/chapters/ChaptersPage'
import { CreativeChapters } from '@/components/entity-page/chapters/CreativeChapters'
import { ProfessionalChapters } from '@/components/entity-page/chapters/ProfessionalChapters'
import { StorefrontChapters } from '@/components/entity-page/chapters/StorefrontChapters'
import { buildChapterData, type ChapterData } from '@/components/entity-page/chapters/model'
import {
  CREATIVE_PRESET,
  PROFESSIONAL_PRESET,
  STOREFRONT_PRESET,
} from '@/components/entity-page/chapters/presets'
import {
  EXAMPLE_NAME,
  EXAMPLE_VARIANT_LABEL,
  buildExampleEntity,
  isExampleVariant,
  type ExampleVariant,
} from '@/lib/example/fixtures'

// Rendered per request: the fixture's dates are relative to the visit, and
// the JSON-LD check reads the deployment's environment.
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ variant: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { variant } = await params
  if (!isExampleVariant(variant)) {
    return { title: 'Page Not Found' }
  }
  return {
    title: `Sample Page: ${EXAMPLE_NAME} (${EXAMPLE_VARIANT_LABEL[variant]})`,
    description: `What a fully filled Premium ${EXAMPLE_VARIANT_LABEL[variant].toLowerCase()} page looks like on The BLACQList. A sample, not a real business.`,
  }
}

/** The chapters layout's data and body for one type, each with its own preset. */
function chaptersView(
  variant: ExampleVariant,
  entity: ReturnType<typeof buildExampleEntity>,
  now: Date
): { data: ChapterData; body: ReactNode } {
  switch (variant) {
    case 'storefront': {
      const data = buildChapterData(entity, STOREFRONT_PRESET, now)
      return { data, body: <StorefrontChapters data={data} preset={STOREFRONT_PRESET} /> }
    }
    case 'professional': {
      const data = buildChapterData(entity, PROFESSIONAL_PRESET, now)
      return { data, body: <ProfessionalChapters data={data} preset={PROFESSIONAL_PRESET} /> }
    }
    case 'creative': {
      const data = buildChapterData(entity, CREATIVE_PRESET, now)
      return { data, body: <CreativeChapters data={data} preset={CREATIVE_PRESET} /> }
    }
  }
}

/**
 * "Sample & Co.": one sample page per template with every Premium
 * feature filled, built from the fixtures in lib/example/fixtures (ticket
 * 184). Open on production too since ticket 206, which links them from For
 * Business; noindex everywhere (layout, robots.txt). Nothing on it
 * writes anywhere: no page-view or post-view event, no tour witness, no quick-action bar,
 * no message composer, and the templates run in example mode, which holds
 * Save and Share and reads images from /images/example.
 *
 * Off production the page carries the same LocalBusiness JSON-LD a live
 * listing emits, so a Preview URL can go straight into Google's Rich Results
 * test. Its `url` points at where the listing would live if it were real. On
 * production it is left out: the live domain never describes a made-up
 * business to search engines.
 *
 * Main's Happening now band (part F) renders above the template from
 * `entity.happeningNow`, as the live listing route does.
 *
 * The sample pages show the Round 3 chapters layout by default (ticket 204,
 * Creative's prototype v7, approved by the founder 2026-11-17 for all three
 * types). It carries its own Happening Now strip inside the Welcome chapter.
 * `?layout=stack` shows the live listing template instead, which the
 * template e2e checks section by section; `?layout=chapters` still works for
 * links shared before the switch.
 */
export default async function ExampleVariantPage({ params, searchParams }: PageProps) {
  const { variant } = await params
  if (!isExampleVariant(variant)) notFound()

  const now = new Date()
  const entity = buildExampleEntity(variant, now)
  const jsonLd = IS_PRODUCTION ? null : buildJsonLd(entity, entity.entity_type)
  const chapters = (await searchParams)?.layout !== 'stack'
  const query = chapters ? '' : '?layout=stack'

  if (chapters) {
    const view = chaptersView(variant, entity, now)
    return (
      <div data-example-variant={variant} data-layout="chapters">
        {jsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        )}
        <ExampleBanner variant={variant} query={query} />
        <ChaptersPage data={view.data} type={variant}>
          {view.body}
        </ChaptersPage>
      </div>
    )
  }

  return (
    <div className="min-h-screen" data-example-variant={variant}>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ExampleBanner variant={variant} query={query} />
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
