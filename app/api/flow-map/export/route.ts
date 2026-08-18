import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { AGGREGATE_MIN_TRANSACTIONS } from '@/lib/spend/aggregate-privacy'
import {
  IMPACT_DATASETS,
  IMPACT_EXPORT_MAX_ROWS,
  buildImpactCsv,
  impactExportFilename,
  isImpactDataset,
  type ImpactRow,
} from '@/lib/spend/impact-report'

// GET /api/flow-map/export?dataset=businesses|cities
//
// Public. Downloadable CSV of the community impact aggregate.
//
// This is the same data /api/flow-map/summary already publishes, with one
// difference: summary returns the top 10 for the page, this returns every row
// that clears AGGREGATE_MIN_TRANSACTIONS. The bound is identical — the
// truncation on the page was a display choice, not a privacy one.
//
// Public rather than admin-gated on purpose. The done-when on the board is
// "real, defensible numbers", and a number nobody outside the company can pull
// is not defensible. The threshold below is what makes publishing it safe; it
// is the same call the four existing public aggregate surfaces make.
//
// Cache: 1 hour ISR, matching /api/flow-map/summary.
export const revalidate = 3600

export async function GET(request: Request) {
  const dataset = new URL(request.url).searchParams.get('dataset')

  if (!isImpactDataset(dataset)) {
    return NextResponse.json(
      {
        error: `Invalid dataset. Expected one of: ${IMPACT_DATASETS.join(', ')}.`,
        code: 'INVALID_DATASET',
      },
      { status: 400 }
    )
  }

  const serviceClient = createServiceClient()

  // The privacy bound. Every row below it is excluded here, in the query,
  // before anything is shaped or encoded — the same position it holds on the
  // page, the JSON API, and /account/community-spend.
  const { data: nodes, error: nodesError } = await serviceClient
    .from('flow_nodes')
    .select('entity_id, total_amount_cents, transaction_count')
    .eq('node_type', dataset === 'businesses' ? 'business' : 'city')
    .gte('transaction_count', AGGREGATE_MIN_TRANSACTIONS)
    .order('total_amount_cents', { ascending: false })
    .limit(IMPACT_EXPORT_MAX_ROWS)

  if (nodesError) {
    return NextResponse.json(
      { error: 'Failed to build the report.', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }

  const nodeRows = nodes ?? []
  const entityIds = nodeRows.map((n) => n.entity_id)

  // Resolve names. A node whose entity has since been deleted keeps its row
  // with an explicit placeholder rather than being dropped: silently removing
  // rows would make the export's own total disagree with itself for a reason
  // the reader cannot see. A visible "(unknown)" is a data-quality signal.
  let nameMap: Record<string, { name: string; slug: string }> = {}
  if (entityIds.length > 0) {
    const { data: entities } = await serviceClient
      .from(dataset === 'businesses' ? 'listings' : 'cities')
      .select('id, name, slug')
      .in('id', entityIds)
    nameMap = Object.fromEntries(
      (entities ?? []).map((e) => [e.id, { name: e.name, slug: e.slug }])
    )
  }

  const rows: ImpactRow[] = nodeRows.map((n) => ({
    name: nameMap[n.entity_id]?.name ?? '(unknown)',
    slug: nameMap[n.entity_id]?.slug ?? '',
    total_amount_cents: n.total_amount_cents,
    transaction_count: n.transaction_count,
  }))

  const isoDate = new Date().toISOString().slice(0, 10)

  return new Response(buildImpactCsv(dataset, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${impactExportFilename(dataset, isoDate)}"`,
    },
  })
}
