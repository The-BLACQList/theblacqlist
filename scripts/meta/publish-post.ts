/**
 * Publish a photo post to Instagram and/or the Facebook Page for The BLACQList.
 * This is a WRITE action — only run after a GATE-PUBLISH approval. As a safety,
 * it dry-runs unless --confirm is passed.
 *
 * Usage:
 *   META_PAGE_ACCESS_TOKEN=... META_PAGE_ID=... META_IG_BUSINESS_ID=... \
 *   npx tsx scripts/meta/publish-post.ts \
 *     --media-url="https://.../image.jpg" \
 *     --caption="..." \
 *     --platforms=ig,fb \
 *     --confirm
 *
 * Without --confirm it prints what it would publish and exits 0.
 * Exits 1 with a clear message if Meta env is not configured or args are missing.
 */
import { createMetaClient, missingMetaEnv } from '../../lib/meta/client'
import { publishFacebookPhoto, publishInstagramPhoto } from '../../lib/meta/publish'

function arg(name: string): string | undefined {
  const prefix = `--${name}=`
  const match = process.argv.find((a) => a.startsWith(prefix))
  return match ? match.slice(prefix.length) : undefined
}
const hasFlag = (name: string): boolean => process.argv.includes(`--${name}`)

const missing = missingMetaEnv()
if (missing.length > 0) {
  console.error(`Meta Graph API not configured — missing: ${missing.join(', ')}.`)
  console.error('Set these in .env.local. See docs/blacqlist/ops/runbooks/meta-setup.md')
  process.exit(1)
}

const mediaUrl = arg('media-url')
const caption = arg('caption')
const platforms = (arg('platforms') ?? 'ig,fb').split(',').map((p) => p.trim())
const confirm = hasFlag('confirm')

if (!mediaUrl || !caption) {
  console.error('Usage: --media-url="..." --caption="..." [--platforms=ig,fb] [--confirm]')
  process.exit(1)
}

async function main(): Promise<void> {
  if (!confirm) {
    console.log('[meta/publish-post] DRY RUN (pass --confirm to publish)')
    console.log(`  platforms: ${platforms.join(', ')}`)
    console.log(`  caption:   ${caption}`)
    console.log(`  media:     ${mediaUrl}`)
    return
  }

  const client = createMetaClient()
  if (platforms.includes('ig')) {
    const res = await publishInstagramPhoto(client, mediaUrl as string, caption as string)
    console.log(`[meta/publish-post] Instagram published: ${res.id}`)
  }
  if (platforms.includes('fb')) {
    const res = await publishFacebookPhoto(client, mediaUrl as string, caption as string)
    console.log(`[meta/publish-post] Facebook published: ${res.id}`)
  }
}

main().catch((err) => {
  console.error('[meta/publish-post]', err)
  process.exit(1)
})
