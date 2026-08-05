/**
 * Fetch Instagram + Facebook Page insights for The BLACQList and write them to the
 * ops folder for the social-report skill. Read-only against Meta.
 *
 * Usage:
 *   META_PAGE_ACCESS_TOKEN=... META_PAGE_ID=... META_IG_BUSINESS_ID=... \
 *   npx tsx scripts/meta/fetch-insights.ts
 *
 * Output: docs/blacqlist/ops/content/social/insights-YYYYMMDD.json
 * Exits 1 with a clear message if Meta env is not configured.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createMetaClient, missingMetaEnv } from '../../lib/meta/client'
import { getFacebookPageInsights, getInstagramInsights } from '../../lib/meta/insights'

const missing = missingMetaEnv()
if (missing.length > 0) {
  console.error(`Meta Graph API not configured — missing: ${missing.join(', ')}.`)
  console.error('Set these in .env.local. See docs/blacqlist/ops/runbooks/meta-setup.md')
  process.exit(1)
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '')
}

async function main(): Promise<void> {
  const client = createMetaClient()
  const instagram = await getInstagramInsights(client)
  const facebook = await getFacebookPageInsights(client)

  const out = { fetchedAt: new Date().toISOString(), instagram, facebook }

  const dir = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'docs',
    'blacqlist',
    'ops',
    'content',
    'social'
  )
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `insights-${stamp()}.json`)
  writeFileSync(file, JSON.stringify(out, null, 2))

  console.log(`[meta/fetch-insights] wrote ${file}`)
}

main().catch((err) => {
  console.error('[meta/fetch-insights]', err)
  process.exit(1)
})
