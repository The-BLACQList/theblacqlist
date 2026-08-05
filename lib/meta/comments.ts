/**
 * Instagram + Facebook comment read/moderate/reply helpers.
 * Reads require pages_read_engagement / instagram_manage_comments.
 * Reply + hide are write actions — call only after GATE-PUBLISH / GATE-MODERATION.
 */
import type { MetaClient } from './client'
import type { FbComment, IgComment, MetaList } from './types'

/** Comments on one IG media object. */
export async function getInstagramComments(
  client: MetaClient,
  mediaId: string,
  limit = 25
): Promise<IgComment[]> {
  const res = await client.get<MetaList<IgComment>>(`${mediaId}/comments`, {
    fields: 'id,text,username,timestamp,like_count',
    limit,
  })
  return res.data
}

/** Reply to an IG comment. Write — GATE-PUBLISH. */
export async function replyToInstagramComment(
  client: MetaClient,
  commentId: string,
  message: string
): Promise<{ id: string }> {
  return client.post<{ id: string }>(`${commentId}/replies`, { message })
}

/** Hide or unhide an IG comment. Write — GATE-MODERATION. */
export async function setInstagramCommentHidden(
  client: MetaClient,
  commentId: string,
  hide: boolean
): Promise<{ success: boolean }> {
  return client.post<{ success: boolean }>(commentId, { hide: hide ? 'true' : 'false' })
}

interface FbFeedPost {
  id: string
  comments?: MetaList<FbComment>
}

/** Recent comments across the Facebook Page's feed, flattened. */
export async function getFacebookPageComments(client: MetaClient, limit = 25): Promise<FbComment[]> {
  const res = await client.get<MetaList<FbFeedPost>>(`${client.env.pageId}/feed`, {
    fields: 'comments{id,message,from,created_time}',
    limit,
  })
  return res.data.flatMap((post) => post.comments?.data ?? [])
}
