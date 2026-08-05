/**
 * Fetch recent Instagram + Facebook interactions (comments, mentions/tags, DMs)
 * for The BLACQList and write them to the ops folder for the social-listening-agent
 * to triage. Read-only against Meta.
 *
 * Usage:
 *   META_PAGE_ACCESS_TOKEN=... META_PAGE_ID=... META_IG_BUSINESS_ID=... \
 *   npx tsx scripts/meta/fetch-interactions.ts
 *
 * Output: docs/blacqlist/ops/content/social/interactions-YYYYMMDD.json
 * Exits 1 with a clear message if Meta env is not configured.
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createMetaClient, missingMetaEnv } from '../../lib/meta/client'
import { getFacebookPageComments, getInstagramComments } from '../../lib/meta/comments'
import { getInstagramTags } from '../../lib/meta/mentions'
import { getConversations, getMessages } from '../../lib/meta/messages'
import type { DirectMessage, IgComment, IgMedia, MetaList } from '../../lib/meta/types'

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

  const media = await client.get<MetaList<IgMedia>>(`${client.env.igBusinessId}/media`, {
    fields: 'id,caption,permalink,timestamp',
    limit: 10,
  })

  const igComments: Array<IgComment & { mediaId: string; permalink?: string }> = []
  for (const item of media.data) {
    const comments = await getInstagramComments(client, item.id, 25)
    for (const comment of comments) {
      igComments.push({ ...comment, mediaId: item.id, permalink: item.permalink })
    }
  }

  const igTags = await getInstagramTags(client, 25)
  const igConversations = await getConversations(client, 'instagram', 25)
  const messengerConversations = await getConversations(client, 'messenger', 25)
  const fbComments = await getFacebookPageComments(client, 25)

  const dms: Array<{ conversationId: string; updated_time?: string; messages: DirectMessage[] }> = []
  for (const conv of [...igConversations, ...messengerConversations]) {
    const messages = await getMessages(client, conv.id, 10)
    dms.push({ conversationId: conv.id, updated_time: conv.updated_time, messages })
  }

  const out = {
    fetchedAt: new Date().toISOString(),
    counts: {
      igComments: igComments.length,
      igTags: igTags.length,
      dmThreads: dms.length,
      fbComments: fbComments.length,
    },
    igComments,
    igTags,
    dms,
    fbComments,
  }

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
  const file = join(dir, `interactions-${stamp()}.json`)
  writeFileSync(file, JSON.stringify(out, null, 2))

  console.log(`[meta/fetch-interactions] wrote ${file}`)
  console.log(
    `[meta/fetch-interactions] ${out.counts.igComments} IG comments, ${out.counts.igTags} tags, ` +
      `${out.counts.dmThreads} DM threads, ${out.counts.fbComments} FB comments`
  )
}

main().catch((err) => {
  console.error('[meta/fetch-interactions]', err)
  process.exit(1)
})
