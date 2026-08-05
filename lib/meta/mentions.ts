/**
 * Instagram mentions/tags — media where the IG Business account is @-mentioned.
 * Requires instagram_manage_comments.
 */
import type { MetaClient } from './client'
import type { IgTag, MetaList } from './types'

export async function getInstagramTags(client: MetaClient, limit = 25): Promise<IgTag[]> {
  const res = await client.get<MetaList<IgTag>>(`${client.env.igBusinessId}/tags`, {
    fields: 'id,caption,username,permalink,timestamp',
    limit,
  })
  return res.data
}
